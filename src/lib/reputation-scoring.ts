/**
 * UwU Reputation Scoring System
 * 
 * LP Score Formula (0-100):
 * - Trade count: max 30 pts
 * - Completion rate: max 25 pts  
 * - Speed: max 15 pts
 * - Account age: max 10 pts
 * - Stake tier: max 10 pts
 * - Dispute penalty: negative
 * 
 * User Score Formula (0-100):
 * - Completed orders: positive
 * - Confirmation rate: positive
 * - Disputes raised: negative
 * - Disputes lost: BAN (score = 0)
 * - Orders abandoned: strong negative
 */

// ============================================
// Types
// ============================================

export interface LPStats {
    address: string
    totalTrades: number
    successfulTrades: number
    totalDisputes: number
    disputesLost: number
    avgCompletionTime: number  // seconds
    memberSince: number        // timestamp
    stakedAmount: number       // USDC
    tier: number               // 1-5
    dailyVolume: number        // USDC traded today
    dailyLimit: number         // Max daily volume
    isActive: boolean
    isBanned: boolean
}

export interface UserStats {
    address: string
    totalOrders: number
    completedOrders: number
    cancelledOrders: number
    disputesRaised: number
    disputesWon: number
    disputesLost: number
    abandonedOrders: number    // Left order without action
    memberSince: number
    avgConfirmationTime: number // seconds
}

export interface ReputationScore {
    score: number              // 0-100
    label: string              // "Excellent", "Good", etc
    breakdown: ScoreBreakdown
    warnings: string[]
    isBanned: boolean
}

export interface ScoreBreakdown {
    tradeCount: number
    completionRate: number
    speed: number
    accountAge: number
    stakeTier: number
    disputePenalty: number
}

// ============================================
// LP Scoring
// ============================================

/**
 * Calculate LP reputation score
 * Total possible: 100 points
 */
export function calculateLPScore(stats: LPStats): ReputationScore {
    const warnings: string[] = []
    
    // If banned, score is 0
    if (stats.isBanned) {
        return {
            score: 0,
            label: 'Banned',
            breakdown: {
                tradeCount: 0,
                completionRate: 0,
                speed: 0,
                accountAge: 0,
                stakeTier: 0,
                disputePenalty: 0
            },
            warnings: ['This LP has been permanently banned'],
            isBanned: true
        }
    }

    // 1. Trade Count (max 30 pts)
    // 1 trade = 0.5 pts, capped at 60 trades
    const tradeCountScore = Math.min(30, stats.totalTrades * 0.5)
    
    // 2. Completion Rate (max 25 pts)
    // Based on (successful / total) * 25
    const completionRate = stats.totalTrades > 0 
        ? (stats.successfulTrades / stats.totalTrades) 
        : 0
    const completionRateScore = completionRate * 25
    
    if (completionRate < 0.9 && stats.totalTrades >= 10) {
        warnings.push(`Completion rate below 90% (${(completionRate * 100).toFixed(1)}%)`)
    }
    
    // 3. Speed (max 15 pts)
    // Under 2 min = 15, under 5 min = 12, under 10 min = 8, under 15 min = 4, over = 0
    let speedScore = 0
    const avgMinutes = stats.avgCompletionTime / 60
    if (avgMinutes <= 2) speedScore = 15
    else if (avgMinutes <= 5) speedScore = 12
    else if (avgMinutes <= 10) speedScore = 8
    else if (avgMinutes <= 15) speedScore = 4
    else {
        speedScore = 0
        warnings.push('Slow average completion time')
    }
    
    // 4. Account Age (max 10 pts)
    // 1 pt per 7 days, capped at 70 days (10 weeks)
    const daysSinceMember = (Date.now() - stats.memberSince) / (1000 * 60 * 60 * 24)
    const ageScore = Math.min(10, daysSinceMember / 7)
    
    if (daysSinceMember < 7) {
        warnings.push('New LP (less than 1 week old)')
    }
    
    // 5. Stake Tier (max 10 pts)
    // Tier 1 = 2, Tier 2 = 4, Tier 3 = 6, Tier 4 = 8, Tier 5 = 10
    const tierScore = stats.tier * 2
    
    // 6. Dispute Penalty (negative)
    // -10 per lost dispute, -5 per raised dispute
    const disputePenalty = (stats.disputesLost * 10) + (stats.totalDisputes * 5)
    
    if (stats.disputesLost > 0) {
        warnings.push(`${stats.disputesLost} lost dispute(s)`)
    }
    
    // Calculate total
    const rawScore = tradeCountScore + completionRateScore + speedScore + ageScore + tierScore - disputePenalty
    const score = Math.max(0, Math.min(100, Math.round(rawScore)))
    
    return {
        score,
        label: getScoreLabel(score),
        breakdown: {
            tradeCount: Math.round(tradeCountScore),
            completionRate: Math.round(completionRateScore),
            speed: Math.round(speedScore),
            accountAge: Math.round(ageScore),
            stakeTier: Math.round(tierScore),
            disputePenalty: Math.round(disputePenalty)
        },
        warnings,
        isBanned: false
    }
}

// ============================================
// User Scoring
// ============================================

/**
 * Calculate user reputation score
 * Total possible: 100 points
 * 
 * Components:
 * - Base: 50 points
 * - Completed orders: +2 per order (max +30)
 * - Confirmation rate: +20 for 100%
 * - Disputes raised: -5 per dispute
 * - Disputes lost: INSTANT BAN
 * - Abandoned orders: -15 per abandonment
 */
export function calculateUserScore(stats: UserStats): ReputationScore {
    const warnings: string[] = []
    
    // Disputes lost = instant ban
    if (stats.disputesLost > 0) {
        return {
            score: 0,
            label: 'Banned',
            breakdown: {
                tradeCount: 0,
                completionRate: 0,
                speed: 0,
                accountAge: 0,
                stakeTier: 0,
                disputePenalty: -100
            },
            warnings: ['User lost a dispute and is banned'],
            isBanned: true
        }
    }
    
    // Base score
    const baseScore = 50
    
    // Completed orders bonus (max +30)
    const orderBonus = Math.min(30, stats.completedOrders * 2)
    
    // Confirmation rate (max +20)
    // Based on (completed / total) * 20
    const confirmationRate = stats.totalOrders > 0
        ? stats.completedOrders / stats.totalOrders
        : 0
    const confirmationBonus = confirmationRate * 20
    
    if (confirmationRate < 0.8 && stats.totalOrders >= 5) {
        warnings.push(`Low confirmation rate (${(confirmationRate * 100).toFixed(0)}%)`)
    }
    
    // Dispute penalty: -5 per dispute raised
    const disputePenalty = stats.disputesRaised * 5
    
    if (stats.disputesRaised > 2) {
        warnings.push('Frequently raises disputes')
    }
    
    // Abandoned penalty: -15 per abandoned order
    const abandonPenalty = stats.abandonedOrders * 15
    
    if (stats.abandonedOrders > 0) {
        warnings.push(`${stats.abandonedOrders} abandoned order(s)`)
    }
    
    // Calculate total
    const rawScore = baseScore + orderBonus + confirmationBonus - disputePenalty - abandonPenalty
    const score = Math.max(0, Math.min(100, Math.round(rawScore)))
    
    return {
        score,
        label: getScoreLabel(score),
        breakdown: {
            tradeCount: Math.round(orderBonus),
            completionRate: Math.round(confirmationBonus),
            speed: 0,
            accountAge: 0,
            stakeTier: 0,
            disputePenalty: Math.round(disputePenalty + abandonPenalty)
        },
        warnings,
        isBanned: false
    }
}

// ============================================
// Utility Functions
// ============================================

function getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent'
    if (score >= 75) return 'Good'
    if (score >= 60) return 'Fair'
    if (score >= 40) return 'Caution'
    if (score > 0) return 'Risky'
    return 'Banned'
}

export function getScoreColor(score: number): 'success' | 'warning' | 'error' {
    if (score >= 75) return 'success'
    if (score >= 50) return 'warning'
    return 'error'
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
    return `${score}/100`
}

/**
 * Get tier name from tier number
 */
export function getTierName(tier: number): string {
    const names = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
    return names[tier] || 'Unknown'
}

/**
 * Get daily limit for tier (in USDC)
 */
export function getDailyLimit(tier: number): number {
    const limits = [0, 50, 100, 250, 500, 1000]
    return limits[tier] || 0
}

/**
 * Check if LP can accept order based on daily limit
 */
export function canAcceptOrder(stats: LPStats, orderAmount: number): boolean {
    if (!stats.isActive || stats.isBanned) return false
    
    const remaining = stats.dailyLimit - stats.dailyVolume
    return orderAmount <= remaining
}

/**
 * Calculate LP ranking score for sorting
 * Higher is better, combines multiple factors
 */
export function calculateLPRanking(stats: LPStats): number {
    const reputation = calculateLPScore(stats)
    
    // Weighted ranking:
    // 40% reputation score
    // 30% available liquidity (normalized to 0-100)
    // 20% speed score
    // 10% tier bonus
    
    const availableLiquidity = Math.min(100, (stats.stakedAmount / 1000) * 100)
    const speedBonus = reputation.breakdown.speed / 15 * 100
    const tierBonus = stats.tier * 20
    
    return (
        reputation.score * 0.4 +
        availableLiquidity * 0.3 +
        speedBonus * 0.2 +
        tierBonus * 0.1
    )
}

/**
 * Sort LPs by ranking (best first)
 */
export function sortLPsByRanking(lps: LPStats[]): LPStats[] {
    return [...lps].sort((a, b) => {
        return calculateLPRanking(b) - calculateLPRanking(a)
    })
}

// ============================================
// Display Helpers
// ============================================

export interface ScoreDisplay {
    score: number
    label: string
    color: 'success' | 'warning' | 'error'
    icon: string
    description: string
}

export function getScoreDisplay(score: ReputationScore): ScoreDisplay {
    const color = getScoreColor(score.score)
    
    let icon = '⚠️'
    let description = 'Exercise caution when trading with this user'
    
    if (score.isBanned) {
        icon = '🚫'
        description = 'This account has been banned'
    } else if (score.score >= 90) {
        icon = '⭐'
        description = 'Highly trusted, excellent track record'
    } else if (score.score >= 75) {
        icon = '✅'
        description = 'Good reputation, reliable trader'
    } else if (score.score >= 60) {
        icon = '👍'
        description = 'Fair reputation, proceed normally'
    } else if (score.score >= 40) {
        icon = '⚠️'
        description = 'Lower reputation, exercise caution'
    }
    
    return {
        score: score.score,
        label: score.label,
        color,
        icon,
        description
    }
}
