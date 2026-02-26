// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title P2PEscrowV4
 * @notice P2P Escrow with LP Rotation, Daily Limits, and Unstaking Notice
 * @dev Builds on V3 with:
 * - Round-robin LP rotation (skip if unresponsive >60s)
 * - Post-order cooldown (30-60s)
 * - Daily volume limits per tier
 * - 24-48h unstaking notice period
 * - Enhanced reputation scoring
 * 
 * LP Tier System:
 * - Tier 1: $50 stake  → $50/day limit
 * - Tier 2: $100 stake → $100/day (2x multiplier)
 * - Tier 3: $250 stake → $250/day (2.5x)
 * - Tier 4: $500 stake → $500/day (2x)
 * - Tier 5: $1000 stake → $1000/day (2x)
 */
contract P2PEscrowV4 is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============================================
    // Constants & State Variables
    // ============================================
    
    IERC20 public immutable usdc;
    
    // Fee configuration
    uint256 public platformFeeBps = 50; // 0.5%
    uint256 public smallOrderFee = 120000; // 0.12 USDC
    uint256 public smallOrderThreshold = 10_000000; // 10 USDC
    
    // Timing configuration
    uint256 public disputeTimeout = 4 hours;
    uint256 public userCooldownPeriod = 1 hours;
    uint256 public lpCooldownPeriod = 2 hours;
    uint256 public disputeCooldownPeriod = 24 hours;
    
    // V4: New configurations
    uint256 public lpPostOrderCooldown = 45 seconds; // 30-60 sec cooldown after order
    uint256 public lpUnresponsiveTimeout = 60 seconds; // Skip LP if no response
    uint256 public unstakingNoticePeriod = 24 hours; // 24-48h notice before unstake
    
    // ============================================
    // LP Tier System with Daily Limits
    // ============================================
    
    // Tier thresholds (USDC 6 decimals)
    uint256[] public tierThresholds = [
        50_000000,   // Tier 1: $50
        100_000000,  // Tier 2: $100
        250_000000,  // Tier 3: $250
        500_000000,  // Tier 4: $500
        1000_000000  // Tier 5: $1000
    ];
    
    // Daily limits match tier thresholds
    uint256[] public dailyLimits = [
        50_000000,   // Tier 1: $50/day
        100_000000,  // Tier 2: $100/day
        250_000000,  // Tier 3: $250/day
        500_000000,  // Tier 4: $500/day
        1000_000000  // Tier 5: $1000/day
    ];
    
    // LP Stake data
    struct LPStake {
        uint256 amount;           // Total staked
        uint256 lockedInOrders;   // Locked in active orders
        uint256 totalTrades;      // Completed trades
        uint256 totalDisputes;    // Disputes involved
        uint256 disputesLost;     // Disputes lost
        uint256 memberSince;      // Registration timestamp
        uint256 avgCompletionTime; // Average completion (seconds)
        uint256 cooldownUntil;    // Cooldown expiry
        uint256 lastOrderTime;    // V4: Last completed order timestamp
        uint256 dailyVolume;      // V4: Volume traded today
        uint256 dailyVolumeDate;  // V4: Date of daily volume (day number)
        uint256 unstakeRequestTime; // V4: When unstake was requested (0 = none)
        uint256 unstakeAmount;    // V4: Amount requested to unstake
        bool isActive;
        bool isBanned;
    }
    
    mapping(address => LPStake) public lpStakes;
    
    // V4: LP rotation tracking
    address[] public activeLPs;
    mapping(address => uint256) public lpListIndex; // Index in activeLPs array
    uint256 public currentLPIndex = 0; // Round-robin pointer
    
    // LP assignment tracking for timeout
    mapping(bytes32 => uint256) public orderAssignedTime;
    
    // User state
    mapping(address => uint256) public userCooldowns;

    // ============================================
    // Escrow System
    // ============================================
    
    enum EscrowStatus {
        None,
        Pending,
        Locked,
        Released,
        Refunded,
        Disputed,
        Cancelled
    }

    struct Escrow {
        address sender;
        address recipient;
        address lp;
        uint256 amount;
        uint256 fee;
        EscrowStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 completedAt;
        uint256 disputedAt;
        string disputeReason;
    }

    mapping(bytes32 => Escrow) public escrows;
    address public arbitrator;

    // ============================================
    // Events
    // ============================================
    
    event LPStaked(address indexed lp, uint256 amount, uint256 tier);
    event LPUnstakeRequested(address indexed lp, uint256 amount, uint256 availableAt);
    event LPUnstaked(address indexed lp, uint256 amount);
    event LPSlashed(address indexed lp, uint256 amount, string reason);
    event LPBanned(address indexed lp);
    event LPActivated(address indexed lp, bool active);
    event LPRotated(address indexed oldLP, address indexed newLP, bytes32 orderId);
    event LPSkipped(address indexed lp, bytes32 orderId, string reason);
    
    event EscrowCreated(bytes32 indexed orderId, address indexed sender, address indexed lp, uint256 amount, uint256 expiresAt);
    event EscrowReleased(bytes32 indexed orderId, address indexed recipient, uint256 amount);
    event EscrowRefunded(bytes32 indexed orderId, address indexed sender, uint256 amount);
    event EscrowCancelled(bytes32 indexed orderId, address indexed canceller);
    event DisputeRaised(bytes32 indexed orderId, address indexed raiser, string reason);
    event DisputeResolved(bytes32 indexed orderId, address indexed winner, uint256 amount);
    event CooldownApplied(address indexed user, uint256 until);
    event DailyLimitReset(address indexed lp, uint256 newDate);

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
    error UserOnCooldown();
    error LPOnCooldown();
    error InsufficientStake();
    error DailyLimitExceeded();
    error UnstakeNoticePending();
    error UnstakeNotReady();
    error NoActiveLPs();
    error LPUnresponsive();

    // ============================================
    // Constructor
    // ============================================
    
    constructor(address _usdc, address _arbitrator) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        arbitrator = _arbitrator;
    }

    // ============================================
    // LP Staking Functions
    // ============================================
    
    /**
     * @notice Stake USDC to become an LP
     */
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (lpStakes[msg.sender].isBanned) revert LPBannedError();
        
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        LPStake storage lpStake = lpStakes[msg.sender];
        lpStake.amount += amount;
        
        if (lpStake.memberSince == 0) {
            lpStake.memberSince = block.timestamp;
        }
        
        // Cancel any pending unstake request
        lpStake.unstakeRequestTime = 0;
        lpStake.unstakeAmount = 0;
        
        emit LPStaked(msg.sender, amount, getTier(msg.sender));
    }
    
    /**
     * @notice Request to unstake (starts notice period)
     * @param amount Amount to unstake
     */
    function requestUnstake(uint256 amount) external nonReentrant {
        LPStake storage lpStake = lpStakes[msg.sender];
        uint256 available = lpStake.amount - lpStake.lockedInOrders;
        
        if (amount > available) revert InsufficientAvailableStake();
        if (lpStake.unstakeRequestTime > 0) revert UnstakeNoticePending();
        
        lpStake.unstakeRequestTime = block.timestamp;
        lpStake.unstakeAmount = amount;
        
        // Deactivate LP during notice period
        if (lpStake.isActive) {
            _removeFromActiveLPs(msg.sender);
            lpStake.isActive = false;
        }
        
        emit LPUnstakeRequested(msg.sender, amount, block.timestamp + unstakingNoticePeriod);
    }
    
    /**
     * @notice Complete unstake after notice period
     */
    function completeUnstake() external nonReentrant {
        LPStake storage lpStake = lpStakes[msg.sender];
        
        if (lpStake.unstakeRequestTime == 0) revert UnstakeNoticePending();
        if (block.timestamp < lpStake.unstakeRequestTime + unstakingNoticePeriod) revert UnstakeNotReady();
        
        uint256 amount = lpStake.unstakeAmount;
        uint256 available = lpStake.amount - lpStake.lockedInOrders;
        
        // Use minimum of requested and available
        if (amount > available) {
            amount = available;
        }
        
        lpStake.amount -= amount;
        lpStake.unstakeRequestTime = 0;
        lpStake.unstakeAmount = 0;
        
        usdc.safeTransfer(msg.sender, amount);
        
        emit LPUnstaked(msg.sender, amount);
    }
    
    /**
     * @notice Cancel unstake request
     */
    function cancelUnstakeRequest() external {
        LPStake storage lpStake = lpStakes[msg.sender];
        lpStake.unstakeRequestTime = 0;
        lpStake.unstakeAmount = 0;
    }
    
    /**
     * @notice Toggle LP active status
     */
    function setActive(bool active) external {
        LPStake storage lpStake = lpStakes[msg.sender];
        if (lpStake.isBanned) revert LPBannedError();
        if (lpStake.amount == 0) revert InsufficientStake();
        if (block.timestamp < lpStake.cooldownUntil) revert LPOnCooldown();
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
    // LP Rotation Functions
    // ============================================
    
    /**
     * @notice Add LP to rotation pool
     */
    function _addToActiveLPs(address lp) internal {
        if (lpListIndex[lp] == 0 && (activeLPs.length == 0 || activeLPs[0] != lp)) {
            activeLPs.push(lp);
            lpListIndex[lp] = activeLPs.length; // 1-indexed
        }
    }
    
    /**
     * @notice Remove LP from rotation pool
     */
    function _removeFromActiveLPs(address lp) internal {
        uint256 index = lpListIndex[lp];
        if (index == 0) return; // Not in list
        
        uint256 lastIndex = activeLPs.length;
        if (index != lastIndex) {
            // Swap with last element
            address lastLP = activeLPs[lastIndex - 1];
            activeLPs[index - 1] = lastLP;
            lpListIndex[lastLP] = index;
        }
        
        activeLPs.pop();
        lpListIndex[lp] = 0;
        
        // Adjust rotation pointer
        if (currentLPIndex >= activeLPs.length && activeLPs.length > 0) {
            currentLPIndex = 0;
        }
    }
    
    /**
     * @notice Get next available LP (round-robin)
     * @param orderAmount Amount needed for the order
     */
    function getNextLP(uint256 orderAmount) public view returns (address) {
        if (activeLPs.length == 0) return address(0);
        
        uint256 startIndex = currentLPIndex;
        uint256 checked = 0;
        
        while (checked < activeLPs.length) {
            uint256 idx = (startIndex + checked) % activeLPs.length;
            address lp = activeLPs[idx];
            LPStake storage lpStake = lpStakes[lp];
            
            // Check if LP is eligible
            if (_isLPEligible(lp, orderAmount)) {
                return lp;
            }
            
            checked++;
        }
        
        return address(0); // No eligible LP found
    }
    
    /**
     * @notice Check if LP is eligible for an order
     */
    function _isLPEligible(address lp, uint256 orderAmount) internal view returns (bool) {
        LPStake storage lpStake = lpStakes[lp];
        
        // Basic checks
        if (!lpStake.isActive || lpStake.isBanned) return false;
        if (block.timestamp < lpStake.cooldownUntil) return false;
        
        // Post-order cooldown
        if (block.timestamp < lpStake.lastOrderTime + lpPostOrderCooldown) return false;
        
        // Stake availability
        uint256 available = lpStake.amount - lpStake.lockedInOrders;
        if (orderAmount > available) return false;
        
        // Daily limit check
        uint256 today = block.timestamp / 1 days;
        uint256 currentDailyVolume = (lpStake.dailyVolumeDate == today) ? lpStake.dailyVolume : 0;
        uint256 tier = getTier(lp);
        if (tier == 0) return false;
        
        uint256 dailyLimit = dailyLimits[tier - 1];
        if (currentDailyVolume + orderAmount > dailyLimit) return false;
        
        return true;
    }
    
    /**
     * @notice Rotate to next LP after assignment
     */
    function _advanceRotation() internal {
        if (activeLPs.length > 0) {
            currentLPIndex = (currentLPIndex + 1) % activeLPs.length;
        }
    }
    
    /**
     * @notice Skip unresponsive LP and reassign order
     */
    function rotateLP(bytes32 orderId) external nonReentrant returns (address) {
        Escrow storage escrow = escrows[orderId];
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        
        // Only allow rotation if LP hasn't responded in time
        uint256 assignedAt = orderAssignedTime[orderId];
        if (block.timestamp < assignedAt + lpUnresponsiveTimeout) revert LPUnresponsive();
        
        address oldLP = escrow.lp;
        
        // Find next eligible LP
        address newLP = getNextLP(escrow.amount);
        if (newLP == address(0) || newLP == oldLP) revert NoActiveLPs();
        
        // Transfer lock from old LP to new LP
        lpStakes[oldLP].lockedInOrders -= escrow.amount;
        lpStakes[newLP].lockedInOrders += escrow.amount;
        
        escrow.lp = newLP;
        orderAssignedTime[orderId] = block.timestamp;
        
        _advanceRotation();
        
        emit LPRotated(oldLP, newLP, orderId);
        emit LPSkipped(oldLP, orderId, "Unresponsive >60s");
        
        return newLP;
    }

    // ============================================
    // Tier & Daily Limit Functions
    // ============================================
    
    function getTier(address lp) public view returns (uint256) {
        uint256 stakeAmount = lpStakes[lp].amount;
        for (uint256 i = tierThresholds.length; i > 0; i--) {
            if (stakeAmount >= tierThresholds[i - 1]) {
                return i;
            }
        }
        return 0;
    }
    
    function getMaxOrderSize(address lp) public view returns (uint256) {
        return lpStakes[lp].amount - lpStakes[lp].lockedInOrders;
    }
    
    function getDailyLimitRemaining(address lp) public view returns (uint256) {
        LPStake storage lpStake = lpStakes[lp];
        uint256 tier = getTier(lp);
        if (tier == 0) return 0;
        
        uint256 limit = dailyLimits[tier - 1];
        uint256 today = block.timestamp / 1 days;
        
        if (lpStake.dailyVolumeDate != today) {
            return limit; // New day, full limit
        }
        
        return limit > lpStake.dailyVolume ? limit - lpStake.dailyVolume : 0;
    }
    
    function _updateDailyVolume(address lp, uint256 amount) internal {
        LPStake storage lpStake = lpStakes[lp];
        uint256 today = block.timestamp / 1 days;
        
        if (lpStake.dailyVolumeDate != today) {
            lpStake.dailyVolume = amount;
            lpStake.dailyVolumeDate = today;
            emit DailyLimitReset(lp, today);
        } else {
            lpStake.dailyVolume += amount;
        }
    }
    
    /**
     * @notice Get LP stats for UI
     */
    function getLPStats(address lp) external view returns (
        uint256 stakeAmount,
        uint256 tier,
        uint256 availableLiquidity,
        uint256 totalTrades,
        uint256 totalDisputes,
        uint256 avgCompletionTime,
        uint256 memberSince,
        uint256 dailyLimitRemaining,
        bool isActive,
        bool isBanned,
        bool hasUnstakeRequest
    ) {
        LPStake storage s = lpStakes[lp];
        return (
            s.amount,
            getTier(lp),
            s.amount - s.lockedInOrders,
            s.totalTrades,
            s.totalDisputes,
            s.avgCompletionTime,
            s.memberSince,
            getDailyLimitRemaining(lp),
            s.isActive,
            s.isBanned,
            s.unstakeRequestTime > 0
        );
    }

    // ============================================
    // Escrow Functions
    // ============================================
    
    /**
     * @notice Create escrow with automatic LP rotation
     */
    function createEscrow(
        bytes32 orderId,
        uint256 amount,
        address recipient,
        uint256 expiresAt
    ) external nonReentrant returns (bytes32, address) {
        if (escrows[orderId].status != EscrowStatus.None) revert EscrowAlreadyExists();
        if (amount == 0) revert InvalidAmount();
        if (expiresAt <= block.timestamp) revert EscrowExpired();
        
        // Check user cooldown
        if (block.timestamp < userCooldowns[msg.sender]) revert UserOnCooldown();
        
        // Get next eligible LP via rotation
        address lp = getNextLP(amount);
        if (lp == address(0)) revert NoActiveLPs();
        
        LPStake storage lpStake = lpStakes[lp];
        
        // Calculate fees
        uint256 fee = (amount * platformFeeBps) / 10000;
        if (amount < smallOrderThreshold) {
            fee += smallOrderFee;
        }
        
        uint256 totalAmount = amount + fee;
        
        // Transfer USDC
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);
        
        // Lock LP's stake and update daily volume
        lpStake.lockedInOrders += amount;
        _updateDailyVolume(lp, amount);
        
        // Create escrow
        escrows[orderId] = Escrow({
            sender: msg.sender,
            recipient: recipient,
            lp: lp,
            amount: amount,
            fee: fee,
            status: EscrowStatus.Locked,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            completedAt: 0,
            disputedAt: 0,
            disputeReason: ""
        });
        
        orderAssignedTime[orderId] = block.timestamp;
        _advanceRotation();
        
        emit EscrowCreated(orderId, msg.sender, lp, amount, expiresAt);
        return (orderId, lp);
    }
    
    /**
     * @notice Release escrow (applies post-order cooldown)
     */
    function releaseEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status == EscrowStatus.None) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.sender && msg.sender != escrow.lp) revert NotAuthorized();
        
        escrow.status = EscrowStatus.Released;
        escrow.completedAt = block.timestamp;
        
        // Unlock LP's stake and apply post-order cooldown
        LPStake storage lpStake = lpStakes[escrow.lp];
        lpStake.lockedInOrders -= escrow.amount;
        lpStake.totalTrades++;
        lpStake.lastOrderTime = block.timestamp; // V4: Post-order cooldown
        
        // Update average completion time
        uint256 completionTime = escrow.completedAt - escrow.createdAt;
        if (lpStake.avgCompletionTime == 0) {
            lpStake.avgCompletionTime = completionTime;
        } else {
            lpStake.avgCompletionTime = (lpStake.avgCompletionTime + completionTime) / 2;
        }
        
        // Transfer USDC
        usdc.safeTransfer(escrow.recipient, escrow.amount);
        if (escrow.fee > 0) {
            usdc.safeTransfer(owner(), escrow.fee);
        }
        
        emit EscrowReleased(orderId, escrow.recipient, escrow.amount);
        return true;
    }
    
    /**
     * @notice Refund escrow
     */
    function refundEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status == EscrowStatus.None) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        
        bool isSender = msg.sender == escrow.sender;
        bool isExpired = block.timestamp > escrow.expiresAt;
        
        if (!isSender && !isExpired) revert NotAuthorized();
        
        escrow.status = EscrowStatus.Refunded;
        
        lpStakes[escrow.lp].lockedInOrders -= escrow.amount;
        
        userCooldowns[msg.sender] = block.timestamp + userCooldownPeriod;
        emit CooldownApplied(msg.sender, userCooldowns[msg.sender]);
        
        usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);
        
        emit EscrowRefunded(orderId, escrow.sender, escrow.amount);
        return true;
    }
    
    /**
     * @notice Raise dispute
     */
    function raiseDispute(bytes32 orderId, string calldata reason) external nonReentrant returns (bytes32) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status == EscrowStatus.None) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.sender && msg.sender != escrow.recipient && msg.sender != escrow.lp) {
            revert NotAuthorized();
        }
        
        escrow.status = EscrowStatus.Disputed;
        escrow.disputedAt = block.timestamp;
        escrow.disputeReason = reason;
        
        userCooldowns[escrow.sender] = block.timestamp + disputeCooldownPeriod;
        lpStakes[escrow.lp].cooldownUntil = block.timestamp + disputeCooldownPeriod;
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
        uint256 slashPercentage
    ) external nonReentrant {
        if (msg.sender != arbitrator) revert NotAuthorized();
        
        Escrow storage escrow = escrows[orderId];
        if (escrow.status != EscrowStatus.Disputed) revert InvalidStatus();
        
        require(block.timestamp <= escrow.disputedAt + disputeTimeout, "Dispute timeout exceeded");
        
        LPStake storage lpStake = lpStakes[escrow.lp];
        lpStake.lockedInOrders -= escrow.amount;
        
        if (releaseToRecipient) {
            escrow.status = EscrowStatus.Released;
            escrow.completedAt = block.timestamp;
            usdc.safeTransfer(escrow.recipient, escrow.amount);
            usdc.safeTransfer(owner(), escrow.fee);
            emit DisputeResolved(orderId, escrow.recipient, escrow.amount);
        } else {
            escrow.status = EscrowStatus.Refunded;
            usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);
            emit DisputeResolved(orderId, escrow.sender, escrow.amount);
        }
        
        if (slashLP && slashPercentage > 0) {
            _slashLP(escrow.lp, slashPercentage, "Dispute resolution");
        }
    }
    
    /**
     * @notice Internal slashing
     */
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
    // View Functions
    // ============================================
    
    function getEscrow(bytes32 orderId) external view returns (
        address sender, address recipient, address lp, uint256 amount,
        uint8 status, uint256 createdAt, uint256 expiresAt, uint256 completedAt
    ) {
        Escrow storage e = escrows[orderId];
        return (e.sender, e.recipient, e.lp, e.amount, uint8(e.status), e.createdAt, e.expiresAt, e.completedAt);
    }
    
    function isUserOnCooldown(address user) external view returns (bool, uint256) {
        return (block.timestamp < userCooldowns[user], userCooldowns[user]);
    }
    
    function isLPOnCooldown(address lp) external view returns (bool, uint256) {
        return (block.timestamp < lpStakes[lp].cooldownUntil, lpStakes[lp].cooldownUntil);
    }
    
    function getActiveLPCount() external view returns (uint256) {
        return activeLPs.length;
    }
    
    function getActiveLPList() external view returns (address[] memory) {
        return activeLPs;
    }
    
    function getUnstakeInfo(address lp) external view returns (
        bool hasPendingRequest, uint256 amount, uint256 requestTime, uint256 availableAt
    ) {
        LPStake storage s = lpStakes[lp];
        return (
            s.unstakeRequestTime > 0,
            s.unstakeAmount,
            s.unstakeRequestTime,
            s.unstakeRequestTime > 0 ? s.unstakeRequestTime + unstakingNoticePeriod : 0
        );
    }

    // ============================================
    // Admin Functions
    // ============================================
    
    function setArbitrator(address _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
    }
    
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high");
        platformFeeBps = _feeBps;
    }
    
    function setSmallOrderFee(uint256 _fee, uint256 _threshold) external onlyOwner {
        smallOrderFee = _fee;
        smallOrderThreshold = _threshold;
    }
    
    function setDisputeTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout <= 4 hours, "Max 4 hour timeout");
        disputeTimeout = _timeout;
    }
    
    function setCooldowns(uint256 _user, uint256 _lp, uint256 _dispute, uint256 _postOrder) external onlyOwner {
        userCooldownPeriod = _user;
        lpCooldownPeriod = _lp;
        disputeCooldownPeriod = _dispute;
        lpPostOrderCooldown = _postOrder;
    }
    
    function setUnstakingNoticePeriod(uint256 _period) external onlyOwner {
        require(_period >= 24 hours && _period <= 48 hours, "Must be 24-48 hours");
        unstakingNoticePeriod = _period;
    }
    
    function setTierThresholds(uint256[] calldata _thresholds) external onlyOwner {
        tierThresholds = _thresholds;
    }
    
    function setDailyLimits(uint256[] calldata _limits) external onlyOwner {
        dailyLimits = _limits;
    }
}
