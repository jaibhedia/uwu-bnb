// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DisputeDAO
 * @notice Decentralized dispute resolution for P2P trades
 * @dev Implements 3-arbitrator voting system with staking and rewards
 * 
 * Tiered Resolution:
 * - Tier 0: Auto-resolution (handled off-chain, high confidence cases)
 * - Tier 1: Community arbitration (3 arbitrators vote, 1-4 hours)
 * - Tier 2: Admin review (core team, 24 hours)
 */
contract DisputeDAO is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public immutable usdc;
    address public escrowContract;
    
    uint256 public minArbitratorStake = 500 * 1e6;    // 500 USDC
    uint256 public minArbitratorTrades = 50;
    uint256 public maxDisputeRateBps = 200;           // 2%
    uint256 public arbitratorRewardBps = 50;          // 0.5% of dispute amount
    uint256 public votingPeriod = 4 hours;
    uint256 public votesRequired = 3;

    // ============ Enums ============

    enum DisputeTier {
        Auto,
        Community,
        Admin
    }

    enum DisputeStatus {
        None,
        Open,
        Voting,
        Resolved,
        Escalated
    }

    // ============ Structs ============

    struct Arbitrator {
        uint256 stake;
        uint256 disputesResolved;
        uint256 correctVotes;
        uint256 totalVotes;
        uint256 totalEarned;
        bool isActive;
        uint256 registeredAt;
    }

    struct Vote {
        bool hasVoted;
        bool favorBuyer;      // true = buyer wins, false = seller wins
        string reasoning;
        uint256 votedAt;
    }

    struct Dispute {
        bytes32 escrowOrderId;
        address buyer;
        address seller;
        uint256 amount;
        DisputeTier tier;
        DisputeStatus status;
        string reason;
        bytes32 buyerEvidence;   // IPFS hash
        bytes32 sellerEvidence;  // IPFS hash
        address[3] selectedArbitrators;
        uint256 votesForBuyer;
        uint256 votesForSeller;
        bool finalDecision;      // true = buyer wins
        uint256 createdAt;
        uint256 votingDeadline;
        uint256 resolvedAt;
    }

    // ============ Mappings ============

    mapping(address => Arbitrator) public arbitrators;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => Vote)) public disputeVotes;
    
    uint256 public disputeCount;
    address[] public arbitratorList;

    // ============ Events ============

    event ArbitratorRegistered(address indexed arbitrator, uint256 stake);
    event ArbitratorRemoved(address indexed arbitrator);
    event DisputeCreated(uint256 indexed disputeId, bytes32 indexed escrowOrderId, DisputeTier tier);
    event ArbitratorsSelected(uint256 indexed disputeId, address[3] arbitrators);
    event VoteCast(uint256 indexed disputeId, address indexed arbitrator, bool favorBuyer);
    event DisputeResolved(uint256 indexed disputeId, bool buyerWins);
    event DisputeEscalated(uint256 indexed disputeId, DisputeTier newTier);
    event ArbitratorRewarded(address indexed arbitrator, uint256 amount);
    event ArbitratorPenalized(address indexed arbitrator, uint256 accuracyDropBps);

    // ============ Errors ============

    error InsufficientStake();
    error NotArbitrator();
    error AlreadyVoted();
    error VotingClosed();
    error VotingNotClosed();
    error DisputeNotFound();
    error InvalidStatus();
    error NotAuthorized();
    error InsufficientArbitrators();

    // ============ Constructor ============

    constructor(address _usdc, address _escrowContract) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        escrowContract = _escrowContract;
    }

    // ============ Arbitrator Management ============

    /**
     * @notice Register as an arbitrator by staking USDC
     * @param stakeAmount Amount to stake (min 500 USDC)
     */
    function registerArbitrator(uint256 stakeAmount) external nonReentrant {
        if (stakeAmount < minArbitratorStake) revert InsufficientStake();
        if (arbitrators[msg.sender].isActive) revert NotAuthorized();

        usdc.safeTransferFrom(msg.sender, address(this), stakeAmount);

        arbitrators[msg.sender] = Arbitrator({
            stake: stakeAmount,
            disputesResolved: 0,
            correctVotes: 0,
            totalVotes: 0,
            totalEarned: 0,
            isActive: true,
            registeredAt: block.timestamp
        });

        arbitratorList.push(msg.sender);

        emit ArbitratorRegistered(msg.sender, stakeAmount);
    }

    /**
     * @notice Withdraw stake and deactivate arbitrator status
     */
    function withdrawArbitratorStake() external nonReentrant {
        Arbitrator storage arb = arbitrators[msg.sender];
        if (!arb.isActive) revert NotArbitrator();

        uint256 amount = arb.stake;
        arb.stake = 0;
        arb.isActive = false;

        usdc.safeTransfer(msg.sender, amount);

        emit ArbitratorRemoved(msg.sender);
    }

    /**
     * @notice Add more stake as arbitrator
     */
    function addArbitratorStake(uint256 amount) external nonReentrant {
        Arbitrator storage arb = arbitrators[msg.sender];
        if (!arb.isActive) revert NotArbitrator();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        arb.stake += amount;
    }

    // ============ Dispute Management ============

    /**
     * @notice Create a new dispute (called by escrow contract or parties)
     */
    function createDispute(
        bytes32 escrowOrderId,
        address buyer,
        address seller,
        uint256 amount,
        string calldata reason,
        DisputeTier tier
    ) external nonReentrant returns (uint256) {
        // Only escrow contract or parties can create disputes
        if (msg.sender != escrowContract && msg.sender != buyer && msg.sender != seller) {
            revert NotAuthorized();
        }

        disputeCount++;
        uint256 disputeId = disputeCount;

        disputes[disputeId] = Dispute({
            escrowOrderId: escrowOrderId,
            buyer: buyer,
            seller: seller,
            amount: amount,
            tier: tier,
            status: DisputeStatus.Open,
            reason: reason,
            buyerEvidence: bytes32(0),
            sellerEvidence: bytes32(0),
            selectedArbitrators: [address(0), address(0), address(0)],
            votesForBuyer: 0,
            votesForSeller: 0,
            finalDecision: false,
            createdAt: block.timestamp,
            votingDeadline: 0,
            resolvedAt: 0
        });

        emit DisputeCreated(disputeId, escrowOrderId, tier);

        // For community tier, select arbitrators immediately
        if (tier == DisputeTier.Community) {
            _selectArbitrators(disputeId);
        }

        return disputeId;
    }

    /**
     * @notice Submit evidence for a dispute
     */
    function submitEvidence(
        uint256 disputeId,
        bytes32 evidenceHash
    ) external {
        Dispute storage dispute = disputes[disputeId];
        if (dispute.status != DisputeStatus.Open && dispute.status != DisputeStatus.Voting) {
            revert InvalidStatus();
        }

        if (msg.sender == dispute.buyer) {
            dispute.buyerEvidence = evidenceHash;
        } else if (msg.sender == dispute.seller) {
            dispute.sellerEvidence = evidenceHash;
        } else {
            revert NotAuthorized();
        }
    }

    /**
     * @notice Start voting phase (after evidence submission)
     */
    function startVoting(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        if (dispute.status != DisputeStatus.Open) revert InvalidStatus();
        if (dispute.tier != DisputeTier.Community) revert InvalidStatus();

        dispute.status = DisputeStatus.Voting;
        dispute.votingDeadline = block.timestamp + votingPeriod;
    }

    /**
     * @notice Cast vote on a dispute (arbitrators only)
     */
    function voteOnDispute(
        uint256 disputeId,
        bool favorBuyer,
        string calldata reasoning
    ) external nonReentrant {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.status != DisputeStatus.Voting) revert InvalidStatus();
        if (block.timestamp > dispute.votingDeadline) revert VotingClosed();
        if (!_isSelectedArbitrator(disputeId, msg.sender)) revert NotArbitrator();
        if (disputeVotes[disputeId][msg.sender].hasVoted) revert AlreadyVoted();

        // Record vote
        disputeVotes[disputeId][msg.sender] = Vote({
            hasVoted: true,
            favorBuyer: favorBuyer,
            reasoning: reasoning,
            votedAt: block.timestamp
        });

        // Update vote counts
        if (favorBuyer) {
            dispute.votesForBuyer++;
        } else {
            dispute.votesForSeller++;
        }

        arbitrators[msg.sender].totalVotes++;

        emit VoteCast(disputeId, msg.sender, favorBuyer);

        // Check if we have enough votes to resolve
        if (dispute.votesForBuyer + dispute.votesForSeller >= votesRequired) {
            _resolveDispute(disputeId);
        }
    }

    /**
     * @notice Force resolve after voting deadline (if not enough votes)
     */
    function forceResolve(uint256 disputeId) external {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.status != DisputeStatus.Voting) revert InvalidStatus();
        if (block.timestamp <= dispute.votingDeadline) revert VotingNotClosed();

        // If we have at least one vote, resolve based on that
        if (dispute.votesForBuyer + dispute.votesForSeller > 0) {
            _resolveDispute(disputeId);
        } else {
            // Escalate to admin if no votes
            _escalateDispute(disputeId);
        }
    }

    /**
     * @notice Admin resolution (for escalated disputes)
     */
    function adminResolve(
        uint256 disputeId,
        bool favorBuyer
    ) external onlyOwner {
        Dispute storage dispute = disputes[disputeId];
        
        if (dispute.status != DisputeStatus.Escalated && dispute.tier != DisputeTier.Admin) {
            revert InvalidStatus();
        }

        dispute.finalDecision = favorBuyer;
        dispute.status = DisputeStatus.Resolved;
        dispute.resolvedAt = block.timestamp;

        // Call escrow contract to execute resolution
        _executeResolution(disputeId, favorBuyer);

        emit DisputeResolved(disputeId, favorBuyer);
    }

    // ============ Internal Functions ============

    function _selectArbitrators(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        
        // Get list of eligible arbitrators
        address[] memory eligible = _getEligibleArbitrators(dispute.buyer, dispute.seller);
        
        if (eligible.length < 3) revert InsufficientArbitrators();

        // Pseudo-random selection (in production, use VRF)
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            disputeId
        )));

        for (uint256 i = 0; i < 3; i++) {
            uint256 index = (seed >> (i * 8)) % eligible.length;
            dispute.selectedArbitrators[i] = eligible[index];
            
            // Swap to avoid selecting same arbitrator twice
            eligible[index] = eligible[eligible.length - 1 - i];
        }

        emit ArbitratorsSelected(disputeId, dispute.selectedArbitrators);
    }

    function _getEligibleArbitrators(
        address buyer,
        address seller
    ) internal view returns (address[] memory) {
        uint256 count = 0;
        
        // Count eligible
        for (uint256 i = 0; i < arbitratorList.length; i++) {
            address arb = arbitratorList[i];
            if (_isEligibleArbitrator(arb, buyer, seller)) {
                count++;
            }
        }

        // Build array
        address[] memory eligible = new address[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < arbitratorList.length; i++) {
            address arb = arbitratorList[i];
            if (_isEligibleArbitrator(arb, buyer, seller)) {
                eligible[index] = arb;
                index++;
            }
        }

        return eligible;
    }

    function _isEligibleArbitrator(
        address arb,
        address buyer,
        address seller
    ) internal view returns (bool) {
        Arbitrator storage arbitrator = arbitrators[arb];
        
        // Must be active with sufficient stake
        if (!arbitrator.isActive) return false;
        if (arbitrator.stake < minArbitratorStake) return false;
        
        // Cannot be a party to the dispute
        if (arb == buyer || arb == seller) return false;
        
        // Check accuracy (if they have voted before)
        if (arbitrator.totalVotes > 0) {
            uint256 accuracy = (arbitrator.correctVotes * 10000) / arbitrator.totalVotes;
            if (accuracy < 5000) return false; // < 50% accuracy
        }

        return true;
    }

    function _isSelectedArbitrator(uint256 disputeId, address arb) internal view returns (bool) {
        Dispute storage dispute = disputes[disputeId];
        return dispute.selectedArbitrators[0] == arb ||
               dispute.selectedArbitrators[1] == arb ||
               dispute.selectedArbitrators[2] == arb;
    }

    function _resolveDispute(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        
        bool buyerWins = dispute.votesForBuyer > dispute.votesForSeller;
        dispute.finalDecision = buyerWins;
        dispute.status = DisputeStatus.Resolved;
        dispute.resolvedAt = block.timestamp;

        // Reward/penalize arbitrators
        _processArbitratorOutcomes(disputeId, buyerWins);

        // Execute resolution in escrow contract
        _executeResolution(disputeId, buyerWins);

        emit DisputeResolved(disputeId, buyerWins);
    }

    function _processArbitratorOutcomes(uint256 disputeId, bool buyerWins) internal {
        Dispute storage dispute = disputes[disputeId];
        uint256 rewardPerArb = (dispute.amount * arbitratorRewardBps) / 10000 / 3;

        for (uint256 i = 0; i < 3; i++) {
            address arb = dispute.selectedArbitrators[i];
            if (arb == address(0)) continue;

            Vote storage vote = disputeVotes[disputeId][arb];
            if (!vote.hasVoted) continue;

            Arbitrator storage arbitrator = arbitrators[arb];
            arbitrator.disputesResolved++;

            if (vote.favorBuyer == buyerWins) {
                // Correct vote - reward
                arbitrator.correctVotes++;
                arbitrator.totalEarned += rewardPerArb;
                usdc.safeTransfer(arb, rewardPerArb);
                emit ArbitratorRewarded(arb, rewardPerArb);
            } else {
                // Wrong vote - accuracy penalty
                emit ArbitratorPenalized(arb, 500); // 5% accuracy drop logged
            }
        }
    }

    function _executeResolution(uint256 disputeId, bool buyerWins) internal {
        Dispute storage dispute = disputes[disputeId];
        
        // Call escrow contract to execute resolution
        // This would call resolveDispute on P2PEscrowV2
        (bool success,) = escrowContract.call(
            abi.encodeWithSignature(
                "resolveDispute(bytes32,bool,bool)",
                dispute.escrowOrderId,
                !buyerWins, // favorSender = seller wins
                true        // slashLoser
            )
        );
        
        require(success, "Resolution execution failed");
    }

    function _escalateDispute(uint256 disputeId) internal {
        Dispute storage dispute = disputes[disputeId];
        dispute.status = DisputeStatus.Escalated;
        dispute.tier = DisputeTier.Admin;

        emit DisputeEscalated(disputeId, DisputeTier.Admin);
    }

    // ============ Admin Functions ============

    function setEscrowContract(address _escrow) external onlyOwner {
        escrowContract = _escrow;
    }

    function setMinArbitratorStake(uint256 _stake) external onlyOwner {
        minArbitratorStake = _stake;
    }

    function setVotingPeriod(uint256 _period) external onlyOwner {
        votingPeriod = _period;
    }

    // ============ View Functions ============

    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function getArbitrator(address arb) external view returns (Arbitrator memory) {
        return arbitrators[arb];
    }

    function getArbitratorAccuracy(address arb) external view returns (uint256) {
        Arbitrator storage arbitrator = arbitrators[arb];
        if (arbitrator.totalVotes == 0) return 10000; // 100% if no votes
        return (arbitrator.correctVotes * 10000) / arbitrator.totalVotes;
    }

    function getVote(uint256 disputeId, address arb) external view returns (Vote memory) {
        return disputeVotes[disputeId][arb];
    }

    function getActiveArbitratorCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < arbitratorList.length; i++) {
            if (arbitrators[arbitratorList[i]].isActive) {
                count++;
            }
        }
        return count;
    }
}
