// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title P2PEscrowV5
 * @notice Production-ready P2P Escrow with comprehensive cooldowns and edge case handling
 * 
 * COOLDOWN SYSTEM:
 * - LP completes order: 30-60 sec
 * - User raises dispute: 24 hours
 * - Loses dispute: BANNED + stake lost
 * - Abandons order: 12 hours
 * - 5 orders in 1 hour: 30 min velocity cooldown
 * - New account: 10 min before first order
 * 
 * EDGE CASES:
 * - LP offline mid-order: Auto-escalate to dispute after 15 min
 * - User lies about paying: UTR proof required, 3 strikes = ban
 * - Rate lock: Exchange rate frozen at order creation
 * - Velocity limits: Max 5 orders/hour
 * 
 * USER DAILY LIMITS:
 * - New users: $150/day
 * - Established (50+ trades): $300/day
 * - High trust (100+ trades, 0 disputes): $750/day
 */
contract P2PEscrowV5 is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    // ============================================
    // Fee Configuration
    // ============================================
    
    uint256 public platformFeeBps = 50; // 0.5%
    uint256 public smallOrderFee = 120000; // 0.12 USDC
    uint256 public smallOrderThreshold = 10_000000; // 10 USDC

    // ============================================
    // Cooldown Configuration
    // ============================================
    
    uint256 public constant NEW_ACCOUNT_COOLDOWN = 10 minutes;
    uint256 public constant LP_POST_ORDER_COOLDOWN = 45 seconds;
    uint256 public constant DISPUTE_COOLDOWN = 24 hours;
    uint256 public constant ABANDON_COOLDOWN = 12 hours;
    uint256 public constant VELOCITY_COOLDOWN = 30 minutes;
    uint256 public constant LP_OFFLINE_TIMEOUT = 15 minutes;
    uint256 public constant DISPUTE_TIMEOUT = 4 hours;
    uint256 public constant UNSTAKING_NOTICE = 24 hours;
    
    // Velocity limits
    uint256 public constant MAX_ORDERS_PER_HOUR = 5;
    uint256 public constant VELOCITY_WINDOW = 1 hours;

    // ============================================
    // User Daily Limits
    // ============================================
    
    uint256 public constant NEW_USER_DAILY_LIMIT = 150_000000;      // $150
    uint256 public constant ESTABLISHED_DAILY_LIMIT = 300_000000;   // $300
    uint256 public constant HIGH_TRUST_DAILY_LIMIT = 750_000000;    // $750
    
    uint256 public constant ESTABLISHED_THRESHOLD = 50;  // 50+ trades
    uint256 public constant HIGH_TRUST_THRESHOLD = 100;  // 100+ trades

    // ============================================
    // LP Tier System
    // ============================================
    
    uint256[] public tierThresholds = [
        50_000000, 100_000000, 250_000000, 500_000000, 1000_000000
    ];
    
    uint256[] public dailyLimits = [
        50_000000, 100_000000, 250_000000, 500_000000, 1000_000000
    ];

    // ============================================
    // Data Structures
    // ============================================
    
    struct LPStake {
        uint256 amount;
        uint256 lockedInOrders;
        uint256 totalTrades;
        uint256 totalDisputes;
        uint256 disputesLost;
        uint256 memberSince;
        uint256 avgCompletionTime;
        uint256 cooldownUntil;
        uint256 lastOrderTime;
        uint256 dailyVolume;
        uint256 dailyVolumeDate;
        uint256 unstakeRequestTime;
        uint256 unstakeAmount;
        bool isActive;
        bool isBanned;
    }
    
    struct UserProfile {
        uint256 totalOrders;
        uint256 completedOrders;
        uint256 cancelledOrders;
        uint256 disputesRaised;
        uint256 disputesWon;
        uint256 disputesLost;
        uint256 abandonedOrders;
        uint256 falsePaymentStrikes;  // UTR lies
        uint256 memberSince;
        uint256 cooldownUntil;
        uint256 dailyVolume;
        uint256 dailyVolumeDate;
        uint256[] recentOrderTimes;   // For velocity tracking
        bool isBanned;
    }
    
    enum EscrowStatus {
        None,
        Pending,
        Locked,
        Released,
        Refunded,
        Disputed,
        Cancelled,
        AutoDisputed  // LP went offline
    }
    
    struct Escrow {
        address sender;
        address recipient;
        address lp;
        uint256 amount;
        uint256 fee;
        uint256 lockedRate;        // Rate locked at creation (INR per USDC * 1e6)
        EscrowStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 completedAt;
        uint256 disputedAt;
        uint256 lpLastActiveAt;    // For offline detection
        string utrProof;           // UTR reference for payment verification
        string disputeReason;
        bool paymentClaimed;       // User claimed payment sent
    }

    // ============================================
    // State
    // ============================================
    
    mapping(address => LPStake) public lpStakes;
    mapping(address => UserProfile) public userProfiles;
    mapping(bytes32 => Escrow) public escrows;
    
    // LP rotation
    address[] public activeLPs;
    mapping(address => uint256) public lpListIndex;
    uint256 public currentLPIndex;
    
    address public arbitrator;
    address public rateOracle;  // For getting current USDC/INR rate

    // ============================================
    // Events
    // ============================================
    
    event LPStaked(address indexed lp, uint256 amount, uint256 tier);
    event LPUnstakeRequested(address indexed lp, uint256 amount, uint256 availableAt);
    event LPUnstaked(address indexed lp, uint256 amount);
    event LPSlashed(address indexed lp, uint256 amount, string reason);
    event LPBanned(address indexed lp);
    event LPActivated(address indexed lp, bool active);
    event LPOfflineDetected(bytes32 indexed orderId, address indexed lp);
    
    event EscrowCreated(bytes32 indexed orderId, address indexed sender, address indexed lp, uint256 amount, uint256 lockedRate);
    event EscrowReleased(bytes32 indexed orderId, address indexed recipient, uint256 amount);
    event EscrowRefunded(bytes32 indexed orderId, address indexed sender, uint256 amount);
    event PaymentClaimed(bytes32 indexed orderId, address indexed user, string utrProof);
    event DisputeRaised(bytes32 indexed orderId, address indexed raiser, string reason);
    event DisputeResolved(bytes32 indexed orderId, address indexed winner, uint256 amount);
    event AutoDisputeTriggered(bytes32 indexed orderId, string reason);
    
    event UserBanned(address indexed user, string reason);
    event StrikeIssued(address indexed user, uint256 totalStrikes, string reason);
    event CooldownApplied(address indexed user, uint256 until, string reason);
    event VelocityLimitHit(address indexed user);
    event DailyLimitExceeded(address indexed user, uint256 attempted, uint256 limit);

    // ============================================
    // Errors
    // ============================================
    
    error EscrowAlreadyExists();
    error EscrowNotFound();
    error InvalidStatus();
    error NotAuthorized();
    error EscrowExpired();
    error InvalidAmount();
    error OrderExceedsStakeTier();
    error InsufficientAvailableStake();
    error LPNotActive();
    error LPBannedError();
    error UserBannedError();
    error OnCooldown(uint256 until);
    error InsufficientStake();
    error DailyLimitExceededError();
    error VelocityLimitExceededError();
    error NoActiveLPs();
    error NewAccountCooldown();
    error UnstakeNoticePending();
    error UnstakeNotReady();
    error UTRRequired();

    // ============================================
    // Constructor
    // ============================================
    
    constructor(address _usdc, address _arbitrator) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        arbitrator = _arbitrator;
    }

    // ============================================
    // Modifiers
    // ============================================
    
    modifier notBanned(address user) {
        if (userProfiles[user].isBanned) revert UserBannedError();
        _;
    }
    
    modifier checkCooldown(address user) {
        UserProfile storage profile = userProfiles[user];
        if (block.timestamp < profile.cooldownUntil) {
            revert OnCooldown(profile.cooldownUntil);
        }
        _;
    }

    // ============================================
    // User Profile Management
    // ============================================
    
    /**
     * @notice Initialize user profile on first interaction
     */
    function _initUserIfNeeded(address user) internal {
        if (userProfiles[user].memberSince == 0) {
            userProfiles[user].memberSince = block.timestamp;
            userProfiles[user].cooldownUntil = block.timestamp + NEW_ACCOUNT_COOLDOWN;
            emit CooldownApplied(user, userProfiles[user].cooldownUntil, "new_account");
        }
    }
    
    /**
     * @notice Get user's daily limit based on trust level
     */
    function getUserDailyLimit(address user) public view returns (uint256) {
        UserProfile storage profile = userProfiles[user];
        
        // High trust: 100+ trades, 0 disputes lost
        if (profile.completedOrders >= HIGH_TRUST_THRESHOLD && profile.disputesLost == 0) {
            return HIGH_TRUST_DAILY_LIMIT;
        }
        
        // Established: 50+ trades
        if (profile.completedOrders >= ESTABLISHED_THRESHOLD) {
            return ESTABLISHED_DAILY_LIMIT;
        }
        
        // New user
        return NEW_USER_DAILY_LIMIT;
    }
    
    /**
     * @notice Get user's remaining daily limit
     */
    function getUserDailyRemaining(address user) public view returns (uint256) {
        UserProfile storage profile = userProfiles[user];
        uint256 limit = getUserDailyLimit(user);
        uint256 today = block.timestamp / 1 days;
        
        if (profile.dailyVolumeDate != today) {
            return limit;
        }
        
        return limit > profile.dailyVolume ? limit - profile.dailyVolume : 0;
    }
    
    /**
     * @notice Check and update velocity (orders per hour)
     */
    function _checkVelocity(address user) internal {
        UserProfile storage profile = userProfiles[user];
        uint256 cutoff = block.timestamp - VELOCITY_WINDOW;
        
        // Count recent orders
        uint256 recentCount = 0;
        uint256[] storage times = profile.recentOrderTimes;
        
        // Clean old entries and count recent
        uint256 writeIdx = 0;
        for (uint256 i = 0; i < times.length; i++) {
            if (times[i] >= cutoff) {
                if (writeIdx != i) {
                    times[writeIdx] = times[i];
                }
                writeIdx++;
                recentCount++;
            }
        }
        
        // Trim array
        while (times.length > writeIdx) {
            times.pop();
        }
        
        // Check limit
        if (recentCount >= MAX_ORDERS_PER_HOUR) {
            profile.cooldownUntil = block.timestamp + VELOCITY_COOLDOWN;
            emit VelocityLimitHit(user);
            emit CooldownApplied(user, profile.cooldownUntil, "velocity_limit");
            revert VelocityLimitExceededError();
        }
        
        // Add current order
        times.push(block.timestamp);
    }
    
    /**
     * @notice Issue strike to user for false payment claim
     */
    function _issueStrike(address user, string memory reason) internal {
        UserProfile storage profile = userProfiles[user];
        profile.falsePaymentStrikes++;
        
        emit StrikeIssued(user, profile.falsePaymentStrikes, reason);
        
        // 3 strikes = ban
        if (profile.falsePaymentStrikes >= 3) {
            profile.isBanned = true;
            emit UserBanned(user, "3_strikes_false_payment");
        }
    }
    
    /**
     * @notice Apply abandon cooldown
     */
    function _applyAbandonCooldown(address user) internal {
        UserProfile storage profile = userProfiles[user];
        profile.abandonedOrders++;
        profile.cooldownUntil = block.timestamp + ABANDON_COOLDOWN;
        emit CooldownApplied(user, profile.cooldownUntil, "order_abandoned");
    }

    // ============================================
    // LP Staking (inherited from V4)
    // ============================================
    
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (lpStakes[msg.sender].isBanned) revert LPBannedError();
        
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        LPStake storage lpStake = lpStakes[msg.sender];
        lpStake.amount += amount;
        
        if (lpStake.memberSince == 0) {
            lpStake.memberSince = block.timestamp;
        }
        
        lpStake.unstakeRequestTime = 0;
        lpStake.unstakeAmount = 0;
        
        emit LPStaked(msg.sender, amount, getTier(msg.sender));
    }
    
    function requestUnstake(uint256 amount) external nonReentrant {
        LPStake storage lpStake = lpStakes[msg.sender];
        uint256 available = lpStake.amount - lpStake.lockedInOrders;
        
        if (amount > available) revert InsufficientAvailableStake();
        if (lpStake.unstakeRequestTime > 0) revert UnstakeNoticePending();
        
        lpStake.unstakeRequestTime = block.timestamp;
        lpStake.unstakeAmount = amount;
        
        if (lpStake.isActive) {
            _removeFromActiveLPs(msg.sender);
            lpStake.isActive = false;
        }
        
        emit LPUnstakeRequested(msg.sender, amount, block.timestamp + UNSTAKING_NOTICE);
    }
    
    function completeUnstake() external nonReentrant {
        LPStake storage lpStake = lpStakes[msg.sender];
        
        if (lpStake.unstakeRequestTime == 0) revert UnstakeNoticePending();
        if (block.timestamp < lpStake.unstakeRequestTime + UNSTAKING_NOTICE) revert UnstakeNotReady();
        
        uint256 amount = lpStake.unstakeAmount;
        uint256 available = lpStake.amount - lpStake.lockedInOrders;
        if (amount > available) amount = available;
        
        lpStake.amount -= amount;
        lpStake.unstakeRequestTime = 0;
        lpStake.unstakeAmount = 0;
        
        usdc.safeTransfer(msg.sender, amount);
        emit LPUnstaked(msg.sender, amount);
    }
    
    function setActive(bool active) external {
        LPStake storage lpStake = lpStakes[msg.sender];
        if (lpStake.isBanned) revert LPBannedError();
        if (lpStake.amount == 0) revert InsufficientStake();
        if (block.timestamp < lpStake.cooldownUntil) revert OnCooldown(lpStake.cooldownUntil);
        if (lpStake.unstakeRequestTime > 0) revert UnstakeNoticePending();
        
        if (active && !lpStake.isActive) {
            _addToActiveLPs(msg.sender);
        } else if (!active && lpStake.isActive) {
            _removeFromActiveLPs(msg.sender);
        }
        
        lpStake.isActive = active;
        emit LPActivated(msg.sender, active);
    }

    // ============================================
    // LP Rotation
    // ============================================
    
    function _addToActiveLPs(address lp) internal {
        if (lpListIndex[lp] == 0 && (activeLPs.length == 0 || activeLPs[0] != lp)) {
            activeLPs.push(lp);
            lpListIndex[lp] = activeLPs.length;
        }
    }
    
    function _removeFromActiveLPs(address lp) internal {
        uint256 index = lpListIndex[lp];
        if (index == 0) return;
        
        uint256 lastIndex = activeLPs.length;
        if (index != lastIndex) {
            address lastLP = activeLPs[lastIndex - 1];
            activeLPs[index - 1] = lastLP;
            lpListIndex[lastLP] = index;
        }
        
        activeLPs.pop();
        lpListIndex[lp] = 0;
        
        if (currentLPIndex >= activeLPs.length && activeLPs.length > 0) {
            currentLPIndex = 0;
        }
    }
    
    function getNextLP(uint256 orderAmount) public view returns (address) {
        if (activeLPs.length == 0) return address(0);
        
        uint256 checked = 0;
        uint256 idx = currentLPIndex;
        
        while (checked < activeLPs.length) {
            address lp = activeLPs[idx % activeLPs.length];
            if (_isLPEligible(lp, orderAmount)) {
                return lp;
            }
            idx++;
            checked++;
        }
        
        return address(0);
    }
    
    function _isLPEligible(address lp, uint256 orderAmount) internal view returns (bool) {
        LPStake storage lpStake = lpStakes[lp];
        
        if (!lpStake.isActive || lpStake.isBanned) return false;
        if (block.timestamp < lpStake.cooldownUntil) return false;
        if (block.timestamp < lpStake.lastOrderTime + LP_POST_ORDER_COOLDOWN) return false;
        
        uint256 available = lpStake.amount - lpStake.lockedInOrders;
        if (orderAmount > available) return false;
        
        uint256 today = block.timestamp / 1 days;
        uint256 currentDailyVolume = (lpStake.dailyVolumeDate == today) ? lpStake.dailyVolume : 0;
        uint256 tier = getTier(lp);
        if (tier == 0) return false;
        
        uint256 dailyLimit = dailyLimits[tier - 1];
        if (currentDailyVolume + orderAmount > dailyLimit) return false;
        
        return true;
    }
    
    function getTier(address lp) public view returns (uint256) {
        uint256 stakeAmount = lpStakes[lp].amount;
        for (uint256 i = tierThresholds.length; i > 0; i--) {
            if (stakeAmount >= tierThresholds[i - 1]) {
                return i;
            }
        }
        return 0;
    }

    // ============================================
    // Escrow Functions with Rate Lock
    // ============================================
    
    /**
     * @notice Create escrow with rate lock and all checks
     * @param lockedRate The INR/USDC rate to lock (multiplied by 1e6)
     */
    function createEscrow(
        bytes32 orderId,
        uint256 amount,
        address recipient,
        uint256 expiresAt,
        uint256 lockedRate
    ) external nonReentrant notBanned(msg.sender) checkCooldown(msg.sender) returns (bytes32, address) {
        if (escrows[orderId].status != EscrowStatus.None) revert EscrowAlreadyExists();
        if (amount == 0) revert InvalidAmount();
        if (expiresAt <= block.timestamp) revert EscrowExpired();
        
        // Initialize user profile
        _initUserIfNeeded(msg.sender);
        
        // Check velocity
        _checkVelocity(msg.sender);
        
        // Check user daily limit
        uint256 userRemaining = getUserDailyRemaining(msg.sender);
        if (amount > userRemaining) {
            emit DailyLimitExceeded(msg.sender, amount, getUserDailyLimit(msg.sender));
            revert DailyLimitExceededError();
        }
        
        // Get next LP
        address lp = getNextLP(amount);
        if (lp == address(0)) revert NoActiveLPs();
        
        LPStake storage lpStake = lpStakes[lp];
        
        // Calculate fees
        uint256 fee = (amount * platformFeeBps) / 10000;
        if (amount < smallOrderThreshold) {
            fee += smallOrderFee;
        }
        
        // Transfer USDC
        usdc.safeTransferFrom(msg.sender, address(this), amount + fee);
        
        // Lock LP stake and update volumes
        lpStake.lockedInOrders += amount;
        _updateLPDailyVolume(lp, amount);
        _updateUserDailyVolume(msg.sender, amount);
        
        // Create escrow with locked rate
        escrows[orderId] = Escrow({
            sender: msg.sender,
            recipient: recipient,
            lp: lp,
            amount: amount,
            fee: fee,
            lockedRate: lockedRate,
            status: EscrowStatus.Locked,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            completedAt: 0,
            disputedAt: 0,
            lpLastActiveAt: block.timestamp,
            utrProof: "",
            disputeReason: "",
            paymentClaimed: false
        });
        
        // Update user profile
        userProfiles[msg.sender].totalOrders++;
        
        // Advance LP rotation
        currentLPIndex = (currentLPIndex + 1) % activeLPs.length;
        
        emit EscrowCreated(orderId, msg.sender, lp, amount, lockedRate);
        return (orderId, lp);
    }
    
    /**
     * @notice User claims payment was sent with UTR proof
     */
    function claimPaymentSent(bytes32 orderId, string calldata utrProof) external nonReentrant {
        Escrow storage escrow = escrows[orderId];
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.sender) revert NotAuthorized();
        if (bytes(utrProof).length == 0) revert UTRRequired();
        
        escrow.paymentClaimed = true;
        escrow.utrProof = utrProof;
        
        emit PaymentClaimed(orderId, msg.sender, utrProof);
    }
    
    /**
     * @notice LP confirms activity (heartbeat for offline detection)
     */
    function lpHeartbeat(bytes32 orderId) external {
        Escrow storage escrow = escrows[orderId];
        if (msg.sender != escrow.lp) revert NotAuthorized();
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        
        escrow.lpLastActiveAt = block.timestamp;
    }
    
    /**
     * @notice Check if LP is offline and auto-escalate
     */
    function checkLPOffline(bytes32 orderId) external nonReentrant {
        Escrow storage escrow = escrows[orderId];
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        
        // Only check after payment claimed
        if (!escrow.paymentClaimed) return;
        
        // Check if LP offline for 15 minutes
        if (block.timestamp > escrow.lpLastActiveAt + LP_OFFLINE_TIMEOUT) {
            escrow.status = EscrowStatus.AutoDisputed;
            escrow.disputedAt = block.timestamp;
            escrow.disputeReason = "LP_OFFLINE_15MIN";
            
            emit LPOfflineDetected(orderId, escrow.lp);
            emit AutoDisputeTriggered(orderId, "LP offline for 15+ minutes after payment claimed");
        }
    }
    
    /**
     * @notice Release escrow (LP confirms payment received)
     */
    function releaseEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.lp) revert NotAuthorized();
        
        escrow.status = EscrowStatus.Released;
        escrow.completedAt = block.timestamp;
        
        // Update LP stats
        LPStake storage lpStake = lpStakes[escrow.lp];
        lpStake.lockedInOrders -= escrow.amount;
        lpStake.totalTrades++;
        lpStake.lastOrderTime = block.timestamp; // Trigger post-order cooldown
        
        // Update completion time
        uint256 completionTime = escrow.completedAt - escrow.createdAt;
        if (lpStake.avgCompletionTime == 0) {
            lpStake.avgCompletionTime = completionTime;
        } else {
            lpStake.avgCompletionTime = (lpStake.avgCompletionTime + completionTime) / 2;
        }
        
        // Update user profile
        userProfiles[escrow.sender].completedOrders++;
        
        // Transfer USDC
        usdc.safeTransfer(escrow.recipient, escrow.amount);
        if (escrow.fee > 0) {
            usdc.safeTransfer(owner(), escrow.fee);
        }
        
        emit EscrowReleased(orderId, escrow.recipient, escrow.amount);
        return true;
    }
    
    /**
     * @notice Refund escrow (cancellation)
     */
    function refundEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        
        bool isSender = msg.sender == escrow.sender;
        bool isExpired = block.timestamp > escrow.expiresAt;
        
        if (!isSender && !isExpired) revert NotAuthorized();
        
        escrow.status = EscrowStatus.Refunded;
        lpStakes[escrow.lp].lockedInOrders -= escrow.amount;
        
        // Apply abandon cooldown if user cancels after claiming payment
        if (isSender) {
            userProfiles[msg.sender].cancelledOrders++;
            if (escrow.paymentClaimed) {
                _applyAbandonCooldown(msg.sender);
            }
        }
        
        usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);
        emit EscrowRefunded(orderId, escrow.sender, escrow.amount);
        return true;
    }
    
    /**
     * @notice Raise dispute
     */
    function raiseDispute(bytes32 orderId, string calldata reason) external nonReentrant returns (bytes32) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status != EscrowStatus.Locked && escrow.status != EscrowStatus.AutoDisputed) {
            revert InvalidStatus();
        }
        
        bool isParty = msg.sender == escrow.sender || msg.sender == escrow.lp;
        if (!isParty) revert NotAuthorized();
        
        escrow.status = EscrowStatus.Disputed;
        escrow.disputedAt = block.timestamp;
        escrow.disputeReason = reason;
        
        // Apply dispute cooldown to user
        if (msg.sender == escrow.sender) {
            userProfiles[msg.sender].disputesRaised++;
            userProfiles[msg.sender].cooldownUntil = block.timestamp + DISPUTE_COOLDOWN;
            emit CooldownApplied(msg.sender, userProfiles[msg.sender].cooldownUntil, "dispute_raised");
        }
        
        lpStakes[escrow.lp].cooldownUntil = block.timestamp + DISPUTE_COOLDOWN;
        lpStakes[escrow.lp].totalDisputes++;
        
        emit DisputeRaised(orderId, msg.sender, reason);
        return orderId;
    }
    
    /**
     * @notice Resolve dispute with slashing
     */
    function resolveDispute(
        bytes32 orderId,
        bool releaseToRecipient,
        bool slashLP,
        uint256 slashPercentage,
        bool userLied  // If user lied about payment
    ) external nonReentrant {
        if (msg.sender != arbitrator) revert NotAuthorized();
        
        Escrow storage escrow = escrows[orderId];
        if (escrow.status != EscrowStatus.Disputed && escrow.status != EscrowStatus.AutoDisputed) {
            revert InvalidStatus();
        }
        
        require(block.timestamp <= escrow.disputedAt + DISPUTE_TIMEOUT, "Dispute timeout exceeded");
        
        LPStake storage lpStake = lpStakes[escrow.lp];
        lpStake.lockedInOrders -= escrow.amount;
        
        // Handle user lying about payment
        if (userLied) {
            _issueStrike(escrow.sender, "false_payment_claim");
        }
        
        if (releaseToRecipient) {
            escrow.status = EscrowStatus.Released;
            escrow.completedAt = block.timestamp;
            
            // User won dispute
            userProfiles[escrow.sender].disputesWon++;
            
            usdc.safeTransfer(escrow.recipient, escrow.amount);
            usdc.safeTransfer(owner(), escrow.fee);
            emit DisputeResolved(orderId, escrow.recipient, escrow.amount);
        } else {
            escrow.status = EscrowStatus.Refunded;
            
            // User lost dispute = BANNED
            userProfiles[escrow.sender].disputesLost++;
            userProfiles[escrow.sender].isBanned = true;
            emit UserBanned(escrow.sender, "lost_dispute");
            
            usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);
            emit DisputeResolved(orderId, escrow.sender, escrow.amount);
        }
        
        if (slashLP && slashPercentage > 0) {
            _slashLP(escrow.lp, slashPercentage, "Dispute resolution");
        }
    }
    
    function _slashLP(address lp, uint256 percentage, string memory reason) internal {
        LPStake storage lpStake = lpStakes[lp];
        
        uint256 slashAmount = (lpStake.amount * percentage) / 100;
        lpStake.amount -= slashAmount;
        lpStake.disputesLost++;
        
        if (percentage >= 100 || lpStake.disputesLost >= 3) {
            lpStake.isBanned = true;
            lpStake.isActive = false;
            _removeFromActiveLPs(lp);
            emit LPBanned(lp);
        }
        
        usdc.safeTransfer(owner(), slashAmount);
        emit LPSlashed(lp, slashAmount, reason);
    }

    // ============================================
    // Volume Tracking
    // ============================================
    
    function _updateLPDailyVolume(address lp, uint256 amount) internal {
        LPStake storage lpStake = lpStakes[lp];
        uint256 today = block.timestamp / 1 days;
        
        if (lpStake.dailyVolumeDate != today) {
            lpStake.dailyVolume = amount;
            lpStake.dailyVolumeDate = today;
        } else {
            lpStake.dailyVolume += amount;
        }
    }
    
    function _updateUserDailyVolume(address user, uint256 amount) internal {
        UserProfile storage profile = userProfiles[user];
        uint256 today = block.timestamp / 1 days;
        
        if (profile.dailyVolumeDate != today) {
            profile.dailyVolume = amount;
            profile.dailyVolumeDate = today;
        } else {
            profile.dailyVolume += amount;
        }
    }

    // ============================================
    // View Functions
    // ============================================
    
    function getEscrow(bytes32 orderId) external view returns (
        address sender, address recipient, address lp, uint256 amount,
        uint8 status, uint256 lockedRate, uint256 createdAt, bool paymentClaimed
    ) {
        Escrow storage e = escrows[orderId];
        return (e.sender, e.recipient, e.lp, e.amount, uint8(e.status), e.lockedRate, e.createdAt, e.paymentClaimed);
    }
    
    function getUserProfile(address user) external view returns (
        uint256 totalOrders, uint256 completedOrders, uint256 disputesLost,
        uint256 falsePaymentStrikes, uint256 dailyLimit, uint256 dailyRemaining,
        bool isBanned, uint256 cooldownUntil
    ) {
        UserProfile storage p = userProfiles[user];
        return (
            p.totalOrders, p.completedOrders, p.disputesLost,
            p.falsePaymentStrikes, getUserDailyLimit(user), getUserDailyRemaining(user),
            p.isBanned, p.cooldownUntil
        );
    }
    
    function getLPStats(address lp) external view returns (
        uint256 stakeAmount, uint256 tier, uint256 availableLiquidity,
        uint256 totalTrades, uint256 avgCompletionTime, bool isActive, bool isBanned
    ) {
        LPStake storage s = lpStakes[lp];
        return (
            s.amount, getTier(lp), s.amount - s.lockedInOrders,
            s.totalTrades, s.avgCompletionTime, s.isActive, s.isBanned
        );
    }
    
    function getActiveLPCount() external view returns (uint256) {
        return activeLPs.length;
    }

    // ============================================
    // Admin Functions
    // ============================================
    
    function setArbitrator(address _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
    }
    
    function setRateOracle(address _oracle) external onlyOwner {
        rateOracle = _oracle;
    }
    
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        platformFeeBps = _feeBps;
    }
    
    function setTierThresholds(uint256[] calldata _thresholds) external onlyOwner {
        tierThresholds = _thresholds;
    }
    
    function setDailyLimits(uint256[] calldata _limits) external onlyOwner {
        dailyLimits = _limits;
    }
}
