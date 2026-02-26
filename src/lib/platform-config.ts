/**
 * Platform Configuration
 * Centralized configuration for uWu P2P platform
 */

export const PLATFORM_CONFIG = {
    // Payment verification thresholds
    verification: {
        autoReleaseThreshold: 85,      // Confidence % for auto-release
        manualReviewThreshold: 70,     // Below this → dispute
        timeoutMinutes: 15,            // Order timeout
        utrLength: 12,                 // UTR validation
    },

    // Fraud detection parameters
    fraud: {
        maxOrdersPerHour: 5,
        maxOrdersPerDay: 20,
        newWalletAgeHours: 168,        // 7 days
        suspiciousHoursStart: 2,       // 2 AM
        suspiciousHoursEnd: 5,         // 5 AM
        roundNumberThreshold: 100,     // Flag multiples of this
        amountEscalationThreshold: 2.0, // 2x increase = suspicious
    },

    // Risk score thresholds
    riskLevels: {
        low: 20,
        medium: 40,
        high: 60,
        // Above 60 = critical
    },

    // Stake requirements
    stakes: {
        basePercentage: 5,             // 5% of order amount
        minStakeUSDC: 10,
        maxStakeUSDC: 5000,
        riskMultipliers: {
            low: 1.0,
            medium: 1.5,
            high: 2.0,
            critical: 3.0,
        },
    },

    // Stake slashing penalties - STRICT
    slashing: {
        // LP SLASHING - No progressive tiers
        lp: {
            disputeLost: 100,          // 100% slash - LP loses ALL locked stake
            orderAbandoned: 10,        // 10% for ghosting + 24hr offline
            lateRelease: 5,            // 5% for >30 min delay
        },
        // USER PENALTIES - 3 Strike System
        user: {
            maxStrikes: 3,
            strike1Cooldown: 12 * 60 * 60,   // 12 hours
            strike2Cooldown: 24 * 60 * 60,   // 24 hours
            strike3Action: 'PERMANENT_BAN' as const,
            forfeitFundsOnBan: true,         // Escrowed funds go to LP
        },
    },

    // Dispute resolution timelines
    disputes: {
        autoResolutionMinutes: 5,
        communityArbitrationHours: 4,
        adminReviewHours: 24,
        arbitratorRewardBps: 50,       // 0.5% of order amount
        minArbitratorStake: 500,       // USDC
        minArbitratorTrades: 50,
        maxArbitratorDisputeRate: 0.02, // 2%
        votesRequired: 3,
    },

    // Payment methods with risk profiles (UPI only)
    paymentMethods: [
        {
            id: 'upi',
            name: 'UPI',
            riskScore: 20,
            reversible: false,
            settlementTime: 'instant',
            requiresExtraVerification: false,
        },
    ],

    // Fee configuration
    fees: {
        protocolFeeBps: 50,              // 0.5% total fee
        smallOrderFee: 0.125,            // $0.125 flat for small orders
        smallOrderThreshold: 10,         // Orders under $10
        lpRewardShare: 0.5,              // LP gets 50% of fee as bonus
        feeCollector: process.env.NEXT_PUBLIC_FEE_COLLECTOR || '0x3bfE354c1A7EC689B8df2682aDbAaF032DD56E61',
    },

    // Order limits
    orders: {
        minAmountUSDC: 0,  // No minimum - any amount allowed
        smallOrderThreshold: 10,  // Below this, charge small order fee
        smallOrderFee: 0.125,  // $0.125 fee for orders < $10
        maxAmountUSDC: 10000,
        expiryMinutes: 15,
        merchantMinStake: 500,
        merchantFeePercentage: 2,
    },

    // Exchange rates - fetched from oracle in production
    // These are fallback values only
    exchangeRates: {
        INR: 84.0,   // Will be updated via oracle
        USD: 1.0,
        BRL: 5.0,
        EUR: 0.92,
    },

    // Production settings
    production: {
        isMainnet: true,
        requiresStaking: true,
        disputeTimeoutHours: 24,
        noKYC: true,  // Permissionless platform
    },
} as const

/**
 * Get payment method config by ID
 */
export function getPaymentMethod(id: string) {
    return PLATFORM_CONFIG.paymentMethods.find(m => m.id === id)
}

/**
 * Get risk level from score
 */
export function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    const { riskLevels } = PLATFORM_CONFIG
    if (score < riskLevels.low) return 'low'
    if (score < riskLevels.medium) return 'medium'
    if (score < riskLevels.high) return 'high'
    return 'critical'
}

/**
 * Get stake multiplier for risk level
 */
export function getStakeMultiplier(riskLevel: 'low' | 'medium' | 'high' | 'critical'): number {
    return PLATFORM_CONFIG.stakes.riskMultipliers[riskLevel]
}

/**
 * Calculate required stake for an order
 */
export function calculateRequiredStake(orderAmount: number, riskScore: number): number {
    const { stakes } = PLATFORM_CONFIG
    const riskLevel = getRiskLevel(riskScore)
    const multiplier = getStakeMultiplier(riskLevel)

    const baseStake = (orderAmount * stakes.basePercentage) / 100
    const requiredStake = baseStake * multiplier

    return Math.max(
        stakes.minStakeUSDC,
        Math.min(stakes.maxStakeUSDC, requiredStake)
    )
}

export type PaymentMethod = typeof PLATFORM_CONFIG.paymentMethods[number]
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
