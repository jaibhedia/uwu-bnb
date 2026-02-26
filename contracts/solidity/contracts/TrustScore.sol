// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrustScore
 * @notice On-chain reputation system for P2P traders
 * @dev Tracks completed trades, disputes, and calculates trust scores
 */
contract TrustScore is Ownable {
    // User reputation data
    struct Reputation {
        uint256 completedTrades;
        uint256 totalVolume;        // Total USDC traded (6 decimals)
        uint256 successfulReleases; // Trades where user released as seller
        uint256 disputes;           // Number of disputes raised
        uint256 disputesLost;       // Disputes ruled against user
        uint256 firstTradeAt;       // Timestamp of first trade
        uint256 lastTradeAt;        // Timestamp of last trade
        bool isLP;                  // Liquidity provider status
        uint256 lpStake;            // Amount staked as LP
    }

    // User address -> Reputation
    mapping(address => Reputation) public reputations;

    // Authorized contracts that can update reputation
    mapping(address => bool) public authorizedContracts;

    // Events
    event TradeCompleted(
        address indexed user,
        uint256 volume,
        bool asSeller
    );

    event DisputeRecorded(
        address indexed user,
        bool lost
    );

    event LPStatusUpdated(
        address indexed user,
        bool isLP,
        uint256 stake
    );

    event ContractAuthorized(address indexed contractAddr, bool status);

    // Errors
    error NotAuthorized();

    modifier onlyAuthorized() {
        if (!authorizedContracts[msg.sender] && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Record a completed trade for a user
     * @param user User address
     * @param volume Trade volume in USDC (6 decimals)
     * @param asSeller True if user was the seller
     */
    function recordTrade(
        address user,
        uint256 volume,
        bool asSeller
    ) external onlyAuthorized {
        Reputation storage rep = reputations[user];

        rep.completedTrades++;
        rep.totalVolume += volume;
        rep.lastTradeAt = block.timestamp;

        if (rep.firstTradeAt == 0) {
            rep.firstTradeAt = block.timestamp;
        }

        if (asSeller) {
            rep.successfulReleases++;
        }

        emit TradeCompleted(user, volume, asSeller);
    }

    /**
     * @notice Record a dispute outcome
     * @param user User address
     * @param lost True if the user lost the dispute
     */
    function recordDispute(
        address user,
        bool lost
    ) external onlyAuthorized {
        Reputation storage rep = reputations[user];

        rep.disputes++;
        if (lost) {
            rep.disputesLost++;
        }

        emit DisputeRecorded(user, lost);
    }

    /**
     * @notice Update LP status
     * @param user User address
     * @param isLP LP status
     * @param stake Stake amount
     */
    function updateLPStatus(
        address user,
        bool isLP,
        uint256 stake
    ) external onlyAuthorized {
        Reputation storage rep = reputations[user];

        rep.isLP = isLP;
        rep.lpStake = stake;

        emit LPStatusUpdated(user, isLP, stake);
    }

    /**
     * @notice Calculate trust score (0-100)
     * @param user User address
     * @return score Trust score (0-100)
     */
    function getTrustScore(address user) external view returns (uint256 score) {
        Reputation storage rep = reputations[user];

        if (rep.completedTrades == 0) {
            return 50; // Default score for new users
        }

        // Base score from trade count (max 30 points)
        uint256 tradeScore = rep.completedTrades > 100
            ? 30
            : (rep.completedTrades * 30) / 100;

        // Volume score (max 20 points, based on $10k threshold)
        uint256 volumeScore = rep.totalVolume > 10_000_000_000 // $10k in USDC
            ? 20
            : (rep.totalVolume * 20) / 10_000_000_000;

        // Release rate score (max 25 points)
        uint256 releaseScore = rep.completedTrades > 0
            ? (rep.successfulReleases * 25) / rep.completedTrades
            : 0;

        // Dispute penalty (up to -20 points)
        uint256 disputePenalty = rep.disputes > 0
            ? (rep.disputesLost * 20) / rep.disputes
            : 0;

        // Account age bonus (max 15 points, 1 year = max)
        uint256 accountAge = block.timestamp - rep.firstTradeAt;
        uint256 ageScore = accountAge > 365 days
            ? 15
            : (accountAge * 15) / 365 days;

        // LP bonus (10 points)
        uint256 lpBonus = rep.isLP ? 10 : 0;

        // Calculate total (cap at 100)
        score = tradeScore + volumeScore + releaseScore + ageScore + lpBonus;
        if (score > disputePenalty) {
            score -= disputePenalty;
        } else {
            score = 0;
        }

        if (score > 100) {
            score = 100;
        }

        return score;
    }

    /**
     * @notice Get detailed reputation data
     * @param user User address
     */
    function getReputation(address user) external view returns (
        uint256 completedTrades,
        uint256 totalVolume,
        uint256 successfulReleases,
        uint256 disputes,
        uint256 disputesLost,
        bool isLP
    ) {
        Reputation storage rep = reputations[user];
        return (
            rep.completedTrades,
            rep.totalVolume,
            rep.successfulReleases,
            rep.disputes,
            rep.disputesLost,
            rep.isLP
        );
    }

    // Admin functions

    function authorizeContract(address contractAddr, bool status) external onlyOwner {
        authorizedContracts[contractAddr] = status;
        emit ContractAuthorized(contractAddr, status);
    }
}
