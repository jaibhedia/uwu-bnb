// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title P2PEscrowV3
 * @notice P2P Escrow with LP Tier System and Anti-Fraud Mechanisms
 * @dev Implements stake-based order limits, 4hr dispute timeout, cooldowns
 *      Uses raw IERC20 calls (NOT SafeERC20) for Arc USDC precompile compatibility
 * 
 * LP Tier System (Stake = Max Order):
 * - Tier 1: $50 stake  → Max order $50
 * - Tier 2: $100 stake → Max order $100
 * - Tier 3: $250 stake → Max order $250
 * - Tier 4: $500 stake → Max order $500
 * - Tier 5: $1000 stake → Max order $1000
 * 
 * Anti-Fraud Mechanisms:
 * - Stake = Max Order (cannot process orders larger than stake)
 * - 4 hour dispute timeout (fast resolution)
 * - Cooldowns after disputes/cancellations
 * - Progressive slashing: 20% warning → 50% strike → 100% ban
 * - Small order fee (10 INR) for orders < 10 USDC
 */
contract P2PEscrowV3 is ReentrancyGuard, Ownable {

    // ============================================
    // Constants & State Variables
    // ============================================
    
    IERC20 public immutable usdc;
    
    // Platform fee (basis points, 100 = 1%)
    uint256 public platformFeeBps = 50; // 0.5%
    
    // Small order fee (for orders < 10 USDC) - 10 INR ≈ 0.12 USDC
    uint256 public smallOrderFee = 120000; // 0.12 USDC in 6 decimals
    uint256 public smallOrderThreshold = 10_000000; // 10 USDC
    
    // Dispute resolution timeout (4 hours for fast resolution)
    uint256 public disputeTimeout = 4 hours;
    
    // Cooldown periods
    uint256 public userCooldownPeriod = 1 hours;
    uint256 public lpCooldownPeriod = 2 hours;
    uint256 public disputeCooldownPeriod = 24 hours;

    // ============================================
    // LP Tier System
    // ============================================
    
    // Tier thresholds (in USDC with 6 decimals)
    uint256[] public tierThresholds = [
        50_000000,   // Tier 1: $50
        100_000000,  // Tier 2: $100
        250_000000,  // Tier 3: $250
        500_000000,  // Tier 4: $500
        1000_000000  // Tier 5: $1000
    ];
    
    // LP Stake data
    struct LPStake {
        uint256 amount;           // Total staked amount
        uint256 lockedInOrders;   // Amount locked in active orders
        uint256 totalTrades;      // Completed trades count
        uint256 totalDisputes;    // Disputes involved in
        uint256 disputesLost;     // Disputes lost (slashing events)
        uint256 memberSince;      // Registration timestamp
        uint256 avgCompletionTime; // Average order completion time (seconds)
        uint256 cooldownUntil;    // Cooldown expiry timestamp
        bool isActive;            // Can accept orders
        bool isBanned;            // Permanently banned
    }
    
    mapping(address => LPStake) public lpStakes;
    
    // User cooldowns (after cancellations/disputes)
    mapping(address => uint256) public userCooldowns;

    // ============================================
    // Escrow System
    // ============================================
    
    enum EscrowStatus {
        None,
        Pending,    // Created, waiting for fiat payment
        Locked,     // USDC locked, fiat being sent
        Released,   // USDC released to recipient
        Refunded,   // USDC refunded to sender
        Disputed,   // Under dispute resolution
        Cancelled   // Cancelled before completion
    }

    struct Escrow {
        address sender;         // Who locked the USDC
        address recipient;      // Who receives USDC
        address lp;             // The LP handling this order
        uint256 amount;         // USDC amount (6 decimals)
        uint256 fee;            // Platform fee
        EscrowStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 completedAt;    // When order was completed
        uint256 disputedAt;
        string disputeReason;
    }

    mapping(bytes32 => Escrow) public escrows;
    
    // Arbitrator address
    address public arbitrator;

    // ============================================
    // Events
    // ============================================
    
    event LPStaked(address indexed lp, uint256 amount, uint256 tier);
    event LPUnstaked(address indexed lp, uint256 amount);
    event LPSlashed(address indexed lp, uint256 amount, string reason);
    event LPBanned(address indexed lp);
    event LPActivated(address indexed lp, bool active);
    
    event EscrowCreated(
        bytes32 indexed orderId,
        address indexed sender,
        address indexed lp,
        uint256 amount,
        uint256 expiresAt
    );
    event EscrowReleased(bytes32 indexed orderId, address indexed recipient, uint256 amount);
    event EscrowRefunded(bytes32 indexed orderId, address indexed sender, uint256 amount);
    event EscrowCancelled(bytes32 indexed orderId, address indexed canceller);
    event DisputeRaised(bytes32 indexed orderId, address indexed raiser, string reason);
    event DisputeResolved(bytes32 indexed orderId, address indexed winner, uint256 amount);
    event CooldownApplied(address indexed user, uint256 until);

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
     * @param amount Amount to stake (determines max order size)
     */
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (lpStakes[msg.sender].isBanned) revert LPBannedError();
        
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        LPStake storage lpStake = lpStakes[msg.sender];
        lpStake.amount += amount;
        
        if (lpStake.memberSince == 0) {
            lpStake.memberSince = block.timestamp;
        }
        
        emit LPStaked(msg.sender, amount, getTier(msg.sender));
    }
    
    /**
     * @notice Unstake USDC (only unlocked amount)
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        LPStake storage lpStake = lpStakes[msg.sender];
        uint256 available = lpStake.amount - lpStake.lockedInOrders;
        
        if (amount > available) revert InsufficientAvailableStake();
        
        lpStake.amount -= amount;
        require(usdc.transfer(msg.sender, amount), "USDC transfer failed");
        
        emit LPUnstaked(msg.sender, amount);
    }
    
    /**
     * @notice Toggle LP active status
     */
    function setActive(bool active) external {
        LPStake storage lpStake = lpStakes[msg.sender];
        if (lpStake.isBanned) revert LPBannedError();
        if (lpStake.amount == 0) revert InsufficientStake();
        if (block.timestamp < lpStake.cooldownUntil) revert LPOnCooldown();
        
        lpStake.isActive = active;
        emit LPActivated(msg.sender, active);
    }
    
    /**
     * @notice Get LP's tier based on stake (1-5)
     */
    function getTier(address lp) public view returns (uint256) {
        uint256 stakeAmount = lpStakes[lp].amount;
        for (uint256 i = tierThresholds.length; i > 0; i--) {
            if (stakeAmount >= tierThresholds[i - 1]) {
                return i;
            }
        }
        return 0; // No tier
    }
    
    /**
     * @notice Get max order size for LP based on stake
     * @dev CRITICAL: Stake = Max Order rule enforced here
     */
    function getMaxOrderSize(address lp) public view returns (uint256) {
        return lpStakes[lp].amount - lpStakes[lp].lockedInOrders;
    }
    
    /**
     * @notice Get LP stats for trust signals display
     */
    function getLPStats(address lp) external view returns (
        uint256 stakeAmount,
        uint256 tier,
        uint256 availableLiquidity,
        uint256 totalTrades,
        uint256 totalDisputes,
        uint256 avgCompletionTime,
        uint256 memberSince,
        bool isActive,
        bool isBanned
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
            s.isActive,
            s.isBanned
        );
    }

    // ============================================
    // Escrow Functions
    // ============================================
    
    /**
     * @notice Create escrow with stake tier enforcement
     * @param orderId Unique order identifier
     * @param amount USDC amount
     * @param recipient Who receives USDC
     * @param lp The LP handling this order
     * @param expiresAt Expiry timestamp
     */
    function createEscrow(
        bytes32 orderId,
        uint256 amount,
        address recipient,
        address lp,
        uint256 expiresAt
    ) external nonReentrant returns (bytes32) {
        if (escrows[orderId].status != EscrowStatus.None) revert EscrowAlreadyExists();
        if (amount == 0) revert InvalidAmount();
        if (expiresAt <= block.timestamp) revert EscrowExpired();
        
        // Check user cooldown
        if (block.timestamp < userCooldowns[msg.sender]) revert UserOnCooldown();
        
        // Validate LP
        LPStake storage lpStake = lpStakes[lp];
        if (!lpStake.isActive) revert LPNotActive();
        if (lpStake.isBanned) revert LPBannedError();
        if (block.timestamp < lpStake.cooldownUntil) revert LPOnCooldown();
        
        // CRITICAL: Enforce stake = max order rule
        uint256 availableStake = lpStake.amount - lpStake.lockedInOrders;
        if (amount > availableStake) revert OrderExceedsStakeTier();
        
        // Calculate fees
        uint256 fee = (amount * platformFeeBps) / 10000;
        
        // Add small order fee if below threshold (10 INR ≈ 0.12 USDC)
        if (amount < smallOrderThreshold) {
            fee += smallOrderFee;
        }
        
        uint256 totalAmount = amount + fee;
        
        // Transfer USDC from sender
        require(usdc.transferFrom(msg.sender, address(this), totalAmount), "USDC transfer failed");
        
        // Lock LP's stake for this order
        lpStake.lockedInOrders += amount;
        
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
        
        emit EscrowCreated(orderId, msg.sender, lp, amount, expiresAt);
        return orderId;
    }
    
    /**
     * @notice Release escrow to recipient
     */
    function releaseEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status == EscrowStatus.None) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.sender && msg.sender != escrow.lp) revert NotAuthorized();
        
        escrow.status = EscrowStatus.Released;
        escrow.completedAt = block.timestamp;
        
        // Unlock LP's stake
        LPStake storage lpStake = lpStakes[escrow.lp];
        lpStake.lockedInOrders -= escrow.amount;
        lpStake.totalTrades++;
        
        // Update average completion time
        uint256 completionTime = escrow.completedAt - escrow.createdAt;
        if (lpStake.avgCompletionTime == 0) {
            lpStake.avgCompletionTime = completionTime;
        } else {
            lpStake.avgCompletionTime = (lpStake.avgCompletionTime + completionTime) / 2;
        }
        
        // Transfer USDC
        require(usdc.transfer(escrow.recipient, escrow.amount), "USDC transfer failed");
        if (escrow.fee > 0) {
            require(usdc.transfer(owner(), escrow.fee), "USDC fee transfer failed");
        }
        
        emit EscrowReleased(orderId, escrow.recipient, escrow.amount);
        return true;
    }
    
    /**
     * @notice Refund escrow to sender
     */
    function refundEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status == EscrowStatus.None) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        
        bool isSender = msg.sender == escrow.sender;
        bool isExpired = block.timestamp > escrow.expiresAt;
        
        if (!isSender && !isExpired) revert NotAuthorized();
        
        escrow.status = EscrowStatus.Refunded;
        
        // Unlock LP's stake
        lpStakes[escrow.lp].lockedInOrders -= escrow.amount;
        
        // Apply cooldown to sender for cancellation
        userCooldowns[msg.sender] = block.timestamp + userCooldownPeriod;
        emit CooldownApplied(msg.sender, userCooldowns[msg.sender]);
        
        // Refund
        require(usdc.transfer(escrow.sender, escrow.amount + escrow.fee), "USDC refund failed");
        
        emit EscrowRefunded(orderId, escrow.sender, escrow.amount);
        return true;
    }
    
    /**
     * @notice Raise a dispute (4 hour resolution window)
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
        
        // Apply cooldown to both parties during dispute
        userCooldowns[escrow.sender] = block.timestamp + disputeCooldownPeriod;
        lpStakes[escrow.lp].cooldownUntil = block.timestamp + disputeCooldownPeriod;
        lpStakes[escrow.lp].totalDisputes++;
        
        emit DisputeRaised(orderId, msg.sender, reason);
        return orderId;
    }
    
    /**
     * @notice Resolve dispute with optional slashing
     * @param orderId Order ID
     * @param releaseToRecipient True to release to recipient, false to refund sender
     * @param slashLP True to slash the LP's stake
     * @param slashPercentage Percentage to slash (20, 50, or 100)
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
        
        // Must resolve within 4 hours
        require(block.timestamp <= escrow.disputedAt + disputeTimeout, "Dispute timeout exceeded");
        
        // Unlock LP's stake first
        LPStake storage lpStake = lpStakes[escrow.lp];
        lpStake.lockedInOrders -= escrow.amount;
        
        if (releaseToRecipient) {
            escrow.status = EscrowStatus.Released;
            escrow.completedAt = block.timestamp;
            require(usdc.transfer(escrow.recipient, escrow.amount), "USDC transfer failed");
            require(usdc.transfer(owner(), escrow.fee), "USDC fee transfer failed");
            emit DisputeResolved(orderId, escrow.recipient, escrow.amount);
        } else {
            escrow.status = EscrowStatus.Refunded;
            require(usdc.transfer(escrow.sender, escrow.amount + escrow.fee), "USDC refund failed");
            emit DisputeResolved(orderId, escrow.sender, escrow.amount);
        }
        
        // Slash LP if required
        if (slashLP && slashPercentage > 0) {
            _slashLP(escrow.lp, slashPercentage, "Dispute resolution");
        }
    }
    
    /**
     * @notice Internal slashing function
     * @dev Progressive slashing: 20% = warning, 50% = strike, 100% = ban
     */
    function _slashLP(address lp, uint256 percentage, string memory reason) internal {
        LPStake storage lpStake = lpStakes[lp];
        
        uint256 slashAmount = (lpStake.amount * percentage) / 100;
        lpStake.amount -= slashAmount;
        lpStake.disputesLost++;
        
        // Ban on 100% slash or 3+ lost disputes
        if (percentage >= 100 || lpStake.disputesLost >= 3) {
            lpStake.isBanned = true;
            lpStake.isActive = false;
            emit LPBanned(lp);
        }
        
        // Transfer slashed amount to treasury
        require(usdc.transfer(owner(), slashAmount), "Slash transfer failed");
        
        emit LPSlashed(lp, slashAmount, reason);
    }

    // ============================================
    // View Functions
    // ============================================
    
    function getEscrow(bytes32 orderId) external view returns (
        address sender,
        address recipient,
        address lp,
        uint256 amount,
        uint8 status,
        uint256 createdAt,
        uint256 expiresAt,
        uint256 completedAt
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
    
    function getTierThresholds() external view returns (uint256[] memory) {
        return tierThresholds;
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
    
    function setCooldowns(uint256 _user, uint256 _lp, uint256 _dispute) external onlyOwner {
        userCooldownPeriod = _user;
        lpCooldownPeriod = _lp;
        disputeCooldownPeriod = _dispute;
    }
    
    function setTierThresholds(uint256[] calldata _thresholds) external onlyOwner {
        tierThresholds = _thresholds;
    }
}
