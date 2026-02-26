// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title P2PEscrow
 * @notice P2P Escrow contract for USDC-to-Fiat settlements
 * @dev Handles escrow creation, release, refunds, and disputes for P2P orders
 * 
 * Flow:
 * 1. Seller locks USDC in escrow (createEscrow)
 * 2. Buyer pays fiat off-chain
 * 3. Seller confirms fiat receipt (releaseEscrow) -> USDC goes to buyer
 * 4. If dispute, arbitrator resolves (resolveDispute)
 */
contract P2PEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // USDC token address (Arc uses USDC for gas and value)
    IERC20 public immutable usdc;

    // Platform fee (basis points, 100 = 1%)
    uint256 public platformFeeBps = 50; // 0.5%
    
    // Dispute resolution timeout (24 hours)
    uint256 public disputeTimeout = 24 hours;

    // Escrow statuses
    enum EscrowStatus {
        None,
        Pending,    // Created, waiting for fiat payment
        Locked,     // USDC locked, fiat being sent
        Released,   // USDC released to recipient
        Refunded,   // USDC refunded to sender
        Disputed    // Under dispute resolution
    }

    // Escrow data structure
    struct Escrow {
        address sender;         // Who locked the USDC (seller in sell order)
        address recipient;      // Who receives USDC (buyer in sell order)
        uint256 amount;         // USDC amount (6 decimals)
        uint256 fee;            // Platform fee
        EscrowStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 disputedAt;
        string disputeReason;
    }

    // Mapping from orderId to Escrow
    mapping(bytes32 => Escrow) public escrows;

    // Arbitrator address (for dispute resolution)
    address public arbitrator;

    // Events
    event EscrowCreated(
        bytes32 indexed orderId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
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

    event ArbitratorUpdated(address indexed oldArbitrator, address indexed newArbitrator);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    // Errors
    error EscrowAlreadyExists();
    error EscrowNotFound();
    error InvalidStatus();
    error NotAuthorized();
    error EscrowExpired();
    error EscrowNotExpired();
    error InvalidAmount();
    error TransferFailed();

    constructor(address _usdc, address _arbitrator) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        arbitrator = _arbitrator;
    }

    /**
     * @notice Create a new escrow by locking USDC
     * @param orderId Unique order identifier
     * @param amount USDC amount to lock (6 decimals)
     * @param recipient Address that will receive USDC on release
     * @param expiresAt Unix timestamp when escrow expires
     * @return escrowId The order ID (same as input)
     */
    function createEscrow(
        bytes32 orderId,
        uint256 amount,
        address recipient,
        uint256 expiresAt
    ) external nonReentrant returns (bytes32) {
        if (escrows[orderId].status != EscrowStatus.None) {
            revert EscrowAlreadyExists();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (expiresAt <= block.timestamp) {
            revert EscrowExpired();
        }

        // Calculate fee
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 totalAmount = amount + fee;

        // Transfer USDC from sender to this contract
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Create escrow
        escrows[orderId] = Escrow({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            fee: fee,
            status: EscrowStatus.Locked,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            disputedAt: 0,
            disputeReason: ""
        });

        emit EscrowCreated(orderId, msg.sender, recipient, amount, expiresAt);

        return orderId;
    }

    /**
     * @notice Release escrow to recipient (seller confirms fiat received)
     * @param orderId The order ID
     * @return success True if release successful
     */
    function releaseEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];

        if (escrow.status == EscrowStatus.None) {
            revert EscrowNotFound();
        }
        if (escrow.status != EscrowStatus.Locked) {
            revert InvalidStatus();
        }
        // Only sender can release (they're confirming they received fiat)
        if (msg.sender != escrow.sender) {
            revert NotAuthorized();
        }

        escrow.status = EscrowStatus.Released;

        // Transfer USDC to recipient
        usdc.safeTransfer(escrow.recipient, escrow.amount);

        // Transfer fee to platform
        if (escrow.fee > 0) {
            usdc.safeTransfer(owner(), escrow.fee);
        }

        emit EscrowReleased(orderId, escrow.recipient, escrow.amount);

        return true;
    }

    /**
     * @notice Refund escrow to sender (order cancelled or expired)
     * @param orderId The order ID
     * @return success True if refund successful
     */
    function refundEscrow(bytes32 orderId) external nonReentrant returns (bool) {
        Escrow storage escrow = escrows[orderId];

        if (escrow.status == EscrowStatus.None) {
            revert EscrowNotFound();
        }
        if (escrow.status != EscrowStatus.Locked) {
            revert InvalidStatus();
        }

        // Sender can refund anytime, recipient can refund after expiry
        bool isSender = msg.sender == escrow.sender;
        bool isRecipientAfterExpiry = msg.sender == escrow.recipient && block.timestamp > escrow.expiresAt;

        if (!isSender && !isRecipientAfterExpiry) {
            revert NotAuthorized();
        }

        escrow.status = EscrowStatus.Refunded;

        // Refund USDC + fee to sender
        usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);

        emit EscrowRefunded(orderId, escrow.sender, escrow.amount);

        return true;
    }

    /**
     * @notice Raise a dispute for an escrow
     * @param orderId The order ID
     * @param reason Dispute reason
     * @return disputeId The order ID
     */
    function raiseDispute(
        bytes32 orderId,
        string calldata reason
    ) external nonReentrant returns (bytes32) {
        Escrow storage escrow = escrows[orderId];

        if (escrow.status == EscrowStatus.None) {
            revert EscrowNotFound();
        }
        if (escrow.status != EscrowStatus.Locked) {
            revert InvalidStatus();
        }
        // Only sender or recipient can raise dispute
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
     * @notice Resolve a dispute (arbitrator only)
     * @param orderId The order ID
     * @param releaseToRecipient True to release to recipient, false to refund sender
     */
    function resolveDispute(
        bytes32 orderId,
        bool releaseToRecipient
    ) external nonReentrant {
        if (msg.sender != arbitrator) {
            revert NotAuthorized();
        }

        Escrow storage escrow = escrows[orderId];

        if (escrow.status != EscrowStatus.Disputed) {
            revert InvalidStatus();
        }

        if (releaseToRecipient) {
            escrow.status = EscrowStatus.Released;
            usdc.safeTransfer(escrow.recipient, escrow.amount);
            usdc.safeTransfer(owner(), escrow.fee);
            emit DisputeResolved(orderId, escrow.recipient, escrow.amount);
        } else {
            escrow.status = EscrowStatus.Refunded;
            usdc.safeTransfer(escrow.sender, escrow.amount + escrow.fee);
            emit DisputeResolved(orderId, escrow.sender, escrow.amount);
        }
    }

    /**
     * @notice Get escrow details
     * @param orderId The order ID
     */
    function getEscrow(bytes32 orderId) external view returns (
        address sender,
        address recipient,
        uint256 amount,
        uint8 status,
        uint256 createdAt,
        uint256 expiresAt
    ) {
        Escrow storage escrow = escrows[orderId];
        return (
            escrow.sender,
            escrow.recipient,
            escrow.amount,
            uint8(escrow.status),
            escrow.createdAt,
            escrow.expiresAt
        );
    }

    // Admin functions

    function setArbitrator(address _arbitrator) external onlyOwner {
        emit ArbitratorUpdated(arbitrator, _arbitrator);
        arbitrator = _arbitrator;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high"); // Max 5%
        emit PlatformFeeUpdated(platformFeeBps, _feeBps);
        platformFeeBps = _feeBps;
    }

    function setDisputeTimeout(uint256 _timeout) external onlyOwner {
        disputeTimeout = _timeout;
    }
}
