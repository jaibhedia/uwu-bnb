// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title P2PEscrowV2
 * @notice Enhanced P2P Escrow with dynamic stakes, slashing, and fraud prevention
 * @dev Handles escrow creation, release, refunds, disputes, and stake management
 * 
 * New Features:
 * - Dynamic stake requirements based on risk score
 * - Stake slashing for bad actors
 * - Rate limiting to prevent abuse
 * - Emergency pause functionality
 * - Circuit breaker for volume limits
 */
contract P2PEscrowV2 is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable usdc;
    
    // Platform settings
    uint256 public platformFeeBps = 50;          // 0.5%
    uint256 public baseStakeBps = 500;           // 5% base stake
    uint256 public disputeTimeout = 24 hours;
    uint256 public rateLimitSeconds = 60;        // 1 min between orders
    uint256 public maxDailyVolume = 1_000_000 * 1e6; // $1M daily limit
    
    // Tracking
    uint256 public dailyVolume;
    uint256 public lastVolumeReset;

    // ============ Enums ============

    enum EscrowStatus {
        None,
        Pending,
        Locked,
        Released,
        Refunded,
        Disputed
    }

    enum PaymentMethod {
        UPI
    }

    // ============ Structs ============

    struct Escrow {
        address sender;
        address recipient;
        uint256 amount;
        uint256 fee;
        uint256 stakeAmount;     // NEW: Stake locked for this escrow
        EscrowStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 disputedAt;
        string disputeReason;
        bytes32 paymentProofHash; // NEW: Hash of UTR + amount + timestamp
    }

    struct StakeProfile {
        uint256 baseStake;           // Total stake deposited
        uint256 lockedStake;         // Stake locked in active escrows
        uint256 tradingLimit;        // Max daily trading volume
        uint256 lastTradeTime;       // Last trade timestamp
        uint256 completedTrades;     // Successful trade count
        uint256 disputesLost;        // Number of disputes lost
        bool isLP;                   // Is a liquidity provider
    }

    struct RiskMultipliers {
        uint16 low;      // 100 = 1.0x
        uint16 medium;   // 150 = 1.5x
        uint16 high;     // 200 = 2.0x
        uint16 critical; // 300 = 3.0x
    }

    // ============ Mappings ============

    mapping(bytes32 => Escrow) public escrows;
    mapping(address => StakeProfile) public stakes;
    mapping(PaymentMethod => uint8) public paymentMethodRisk;
    
    // ============ Immutables & Constants ============

    address public arbitrator;
    address public disputeDAO;     // NEW: DisputeDAO contract address
    RiskMultipliers public riskMultipliers;

    // Slashing percentages (basis points, 100 = 1%)
    uint256 public constant SLASH_ORDER_TIMEOUT = 2000;      // 20%
    uint256 public constant SLASH_FAKE_PROOF = 10000;        // 100%
    uint256 public constant SLASH_DISPUTE_LOST = 5000;       // 50%
    uint256 public constant SLASH_PAYMENT_REVERSAL = 20000;  // 200%
    uint256 public constant SLASH_LATE_RELEASE = 500;        // 5%

    // ============ Events ============

    event EscrowCreated(
        bytes32 indexed orderId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 stakeAmount,
        uint256 expiresAt
    );

    event EscrowReleased(
        bytes32 indexed orderId,
        address indexed recipient,
        uint256 amount
    );

    event EscrowRefunded(
        bytes32 indexed orderId,
        address indexed sender,
        uint256 amount
    );

    event DisputeRaised(
        bytes32 indexed orderId,
        address indexed raiser,
        string reason
    );

    event DisputeResolved(
        bytes32 indexed orderId,
        address indexed winner,
        uint256 amount
    );

    event StakeDeposited(address indexed user, uint256 amount);
    event StakeWithdrawn(address indexed user, uint256 amount);
    event StakeSlashed(address indexed user, uint256 amount, string reason);
    event PaymentProofSubmitted(bytes32 indexed orderId, bytes32 proofHash);
    event DailyVolumeReset(uint256 oldVolume, uint256 timestamp);

    // ============ Errors ============

    error EscrowAlreadyExists();
    error EscrowNotFound();
    error InvalidStatus();
    error NotAuthorized();
    error EscrowExpired();
    error EscrowNotExpired();
    error InvalidAmount();
    error TransferFailed();
    error InsufficientStake();
    error RateLimitExceeded();
    error DailyVolumeLimitExceeded();
    error OrderBlocked();

    // ============ Modifiers ============

    modifier rateLimited() {
        if (block.timestamp - stakes[msg.sender].lastTradeTime < rateLimitSeconds) {
            revert RateLimitExceeded();
        }
        _;
    }

    modifier volumeLimited(uint256 amount) {
        _resetDailyVolumeIfNeeded();
        if (dailyVolume + amount > maxDailyVolume) {
            revert DailyVolumeLimitExceeded();
        }
        _;
    }

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _arbitrator
    ) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        arbitrator = _arbitrator;
        lastVolumeReset = block.timestamp;
        
        // Initialize risk multipliers
        riskMultipliers = RiskMultipliers({
            low: 100,
            medium: 150,
            high: 200,
            critical: 300
        });

        // Initialize payment method risk (UPI only)
        paymentMethodRisk[PaymentMethod.UPI] = 20;
    }

    // ============ Stake Management ============

    /**
     * @notice Deposit stake to enable trading
     * @param amount Amount of USDC to stake
     */
    function depositStake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        stakes[msg.sender].baseStake += amount;
        
        emit StakeDeposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw available stake (not locked in escrows)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        StakeProfile storage profile = stakes[msg.sender];
        uint256 availableStake = profile.baseStake - profile.lockedStake;
        
        if (amount > availableStake) revert InsufficientStake();
        
        profile.baseStake -= amount;
        usdc.safeTransfer(msg.sender, amount);
        
        emit StakeWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Calculate required stake for an order
     * @param user User address
     * @param amount Order amount
     * @param riskScore Risk score (0-100)
     */
    function calculateRequiredStake(
        address user,
        uint256 amount,
        uint8 riskScore
    ) public view returns (uint256) {
        // Base stake: 5% of order amount
        uint256 baseRequired = (amount * baseStakeBps) / 10000;
        
        // Get risk multiplier
        uint256 multiplier;
        if (riskScore < 20) {
            multiplier = riskMultipliers.low;
        } else if (riskScore < 40) {
            multiplier = riskMultipliers.medium;
        } else if (riskScore < 60) {
            multiplier = riskMultipliers.high;
        } else {
            multiplier = riskMultipliers.critical;
        }
        
        // Trust discount: More trades = lower stake (max 20% discount)
        uint256 trustDiscount = 100;
        if (stakes[user].completedTrades > 50) {
            trustDiscount = 80;
        } else if (stakes[user].completedTrades > 20) {
            trustDiscount = 90;
        }
        
        return (baseRequired * multiplier * trustDiscount) / 10000;
    }

    // ============ Escrow Functions ============

    /**
     * @notice Create a new escrow with stake
     */
    function createEscrow(
        bytes32 orderId,
        uint256 amount,
        address recipient,
        uint256 expiresAt,
        uint8 riskScore
    ) external nonReentrant whenNotPaused rateLimited volumeLimited(amount) returns (bytes32) {
        if (escrows[orderId].status != EscrowStatus.None) {
            revert EscrowAlreadyExists();
        }
        if (amount == 0) revert InvalidAmount();
        if (expiresAt <= block.timestamp) revert EscrowExpired();
        if (riskScore >= 70) revert OrderBlocked();

        // Calculate stake requirement
        uint256 requiredStake = calculateRequiredStake(msg.sender, amount, riskScore);
        StakeProfile storage profile = stakes[msg.sender];
        uint256 availableStake = profile.baseStake - profile.lockedStake;
        
        if (availableStake < requiredStake) revert InsufficientStake();

        // Calculate fee
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 totalAmount = amount + fee;

        // Transfer USDC
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Lock stake
        profile.lockedStake += requiredStake;
        profile.lastTradeTime = block.timestamp;

        // Update daily volume
        dailyVolume += amount;

        // Create escrow
        escrows[orderId] = Escrow({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            fee: fee,
            stakeAmount: requiredStake,
            status: EscrowStatus.Locked,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            disputedAt: 0,
            disputeReason: "",
            paymentProofHash: bytes32(0)
        });

        emit EscrowCreated(orderId, msg.sender, recipient, amount, requiredStake, expiresAt);

        return orderId;
    }

    /**
     * @notice Submit payment proof hash
     */
    function submitPaymentProof(
        bytes32 orderId,
        bytes32 proofHash
    ) external nonReentrant {
        Escrow storage escrow = escrows[orderId];
        
        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.recipient) revert NotAuthorized();
        
        escrow.paymentProofHash = proofHash;
        
        emit PaymentProofSubmitted(orderId, proofHash);
    }

    /**
     * @notice Release escrow to recipient
     */
    function releaseEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];

        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.sender) revert NotAuthorized();

        // Check for late release (>30 min)
        if (block.timestamp > escrow.createdAt + 30 minutes) {
            _slashStake(escrow.sender, escrow.stakeAmount, SLASH_LATE_RELEASE, "Late release");
        }

        // Update status
        escrow.status = EscrowStatus.Released;

        // Return stake
        stakes[escrow.sender].lockedStake -= escrow.stakeAmount;
        stakes[escrow.sender].completedTrades += 1;

        // Transfer amounts
        usdc.safeTransfer(escrow.recipient, escrow.amount);
        usdc.safeTransfer(owner(), escrow.fee);

        emit EscrowReleased(orderId, escrow.recipient, escrow.amount);

        return true;
    }

    /**
     * @notice Refund escrow to sender (after expiry)
     */
    function refundEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];

        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (block.timestamp < escrow.expiresAt) revert EscrowNotExpired();

        // Slash recipient stake for timeout
        if (stakes[escrow.recipient].baseStake > 0) {
            _slashStake(escrow.recipient, stakes[escrow.recipient].baseStake, SLASH_ORDER_TIMEOUT, "Order timeout");
        }

        escrow.status = EscrowStatus.Refunded;

        // Return sender's stake
        stakes[escrow.sender].lockedStake -= escrow.stakeAmount;

        // Refund
        usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);

        emit EscrowRefunded(orderId, escrow.sender, escrow.amount);

        return true;
    }

    /**
     * @notice Raise a dispute
     */
    function raiseDispute(
        bytes32 orderId,
        string calldata reason
    ) external nonReentrant returns (bytes32) {
        Escrow storage escrow = escrows[orderId];

        if (escrow.status != EscrowStatus.Locked) revert InvalidStatus();
        if (msg.sender != escrow.sender && msg.sender != escrow.recipient) {
            revert NotAuthorized();
        }

        escrow.status = EscrowStatus.Disputed;
        escrow.disputedAt = block.timestamp;
        escrow.disputeReason = reason;

        emit DisputeRaised(orderId, msg.sender, reason);

        return orderId;
    }

    /**
     * @notice Resolve dispute (arbitrator or DisputeDAO only)
     */
    function resolveDispute(
        bytes32 orderId,
        bool favorSender,
        bool slashLoser
    ) external nonReentrant {
        if (msg.sender != arbitrator && msg.sender != disputeDAO) {
            revert NotAuthorized();
        }

        Escrow storage escrow = escrows[orderId];
        if (escrow.status != EscrowStatus.Disputed) revert InvalidStatus();

        address winner = favorSender ? escrow.sender : escrow.recipient;
        address loser = favorSender ? escrow.recipient : escrow.sender;

        // Slash loser's stake if requested
        if (slashLoser && stakes[loser].baseStake > 0) {
            _slashStake(loser, stakes[loser].baseStake, SLASH_DISPUTE_LOST, "Dispute lost");
            stakes[loser].disputesLost += 1;
        }

        // Return winner's locked stake
        if (winner == escrow.sender) {
            stakes[escrow.sender].lockedStake -= escrow.stakeAmount;
        }

        // Transfer funds to winner
        if (favorSender) {
            escrow.status = EscrowStatus.Refunded;
            usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);
        } else {
            escrow.status = EscrowStatus.Released;
            usdc.safeTransfer(escrow.recipient, escrow.amount);
            usdc.safeTransfer(owner(), escrow.fee);
        }

        emit DisputeResolved(orderId, winner, escrow.amount);
    }

    // ============ Internal Functions ============

    function _slashStake(
        address user,
        uint256 stakeAmount,
        uint256 slashBps,
        string memory reason
    ) internal {
        uint256 slashAmount = (stakeAmount * slashBps) / 10000;
        
        if (slashAmount > stakes[user].baseStake) {
            slashAmount = stakes[user].baseStake;
        }
        
        stakes[user].baseStake -= slashAmount;
        
        // Transfer slashed amount to treasury
        usdc.safeTransfer(owner(), slashAmount);
        
        emit StakeSlashed(user, slashAmount, reason);
    }

    function _resetDailyVolumeIfNeeded() internal {
        if (block.timestamp > lastVolumeReset + 1 days) {
            emit DailyVolumeReset(dailyVolume, block.timestamp);
            dailyVolume = 0;
            lastVolumeReset = block.timestamp;
        }
    }

    // ============ Admin Functions ============

    function setArbitrator(address _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
    }

    function setDisputeDAO(address _disputeDAO) external onlyOwner {
        disputeDAO = _disputeDAO;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high"); // Max 5%
        platformFeeBps = _feeBps;
    }

    function setBaseStake(uint256 _stakeBps) external onlyOwner {
        require(_stakeBps <= 2000, "Stake too high"); // Max 20%
        baseStakeBps = _stakeBps;
    }

    function setMaxDailyVolume(uint256 _volume) external onlyOwner {
        maxDailyVolume = _volume;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    function getEscrow(bytes32 orderId) external view returns (Escrow memory) {
        return escrows[orderId];
    }

    function getStakeProfile(address user) external view returns (StakeProfile memory) {
        return stakes[user];
    }

    function getAvailableStake(address user) external view returns (uint256) {
        return stakes[user].baseStake - stakes[user].lockedStake;
    }
}
