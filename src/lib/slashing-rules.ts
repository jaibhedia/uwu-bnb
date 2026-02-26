/**
 * SLASHING RULES
 * ==============
 * 
 * LP SLASHING (STRICT - No Second Chances):
 * - LP loses ANY dispute → 100% of locked stake for that order is slashed
 * - No progressive tiers - immediate full slash
 * - Reason: LP stake = max order value, so they must lose it all if they cheat
 * 
 * USER PENALTIES (3-Strike System):
 * - 1st false claim: Warning + 12hr cooldown
 * - 2nd false claim: 24hr cooldown + trust score -10
 * - 3rd false claim: PERMANENT BAN + any funds in escrow forfeited to LP
 */

export interface SlashResult {
    amount: number
    reason: string
    additionalPenalty?: string
}

export interface UserPenalty {
    action: 'warning' | 'cooldown' | 'ban'
    cooldownSeconds: number
    forfeitFunds: boolean
    trustPenalty: number
    message: string
}

// LP Slashing - STRICT rules
export const LP_SLASH_RULES = {
    // LP loses dispute = loses 100% of stake locked for that order
    DISPUTE_LOST: {
        slashPercent: 100,
        description: 'Full stake slashed for losing dispute',
    },
    // LP abandons order (doesn't respond in 15 min)
    ORDER_ABANDONED: {
        slashPercent: 10,
        cooldownHours: 24,
        description: '10% penalty + 24hr forced offline',
    },
    // LP releases late (>30 min after user confirmation)
    LATE_RELEASE: {
        slashPercent: 5,
        description: '5% penalty for delayed release',
    },
} as const

// User penalty tiers
export const USER_STRIKE_RULES = {
    1: {
        action: 'warning' as const,
        cooldownHours: 12,
        trustPenalty: -5,
        forfeitFunds: false,
        message: 'Warning issued. 12-hour cooldown applied.',
    },
    2: {
        action: 'cooldown' as const,
        cooldownHours: 24,
        trustPenalty: -10,
        forfeitFunds: false,
        message: 'Second strike. 24-hour cooldown applied.',
    },
    3: {
        action: 'ban' as const,
        cooldownHours: Infinity,
        trustPenalty: -100,
        forfeitFunds: true,
        message: 'Third strike. PERMANENT BAN. Escrowed funds forfeited.',
    },
} as const

/**
 * Calculate LP slash amount for a given offense
 */
export function calculateLPSlash(
    lockedStake: number,
    offense: 'DISPUTE_LOST' | 'ORDER_ABANDONED' | 'LATE_RELEASE'
): SlashResult {
    const rule = LP_SLASH_RULES[offense]
    const slashAmount = (lockedStake * rule.slashPercent) / 100

    return {
        amount: slashAmount,
        reason: offense,
        additionalPenalty: 'cooldownHours' in rule 
            ? `${rule.cooldownHours}hr offline cooldown` 
            : undefined,
    }
}

/**
 * Get user penalty based on current strike count
 */
export function getUserPenalty(strikeCount: number): UserPenalty {
    // Clamp to max 3 (any count >= 3 results in ban)
    const effectiveStrikes = Math.min(strikeCount, 3) as 1 | 2 | 3
    const rule = USER_STRIKE_RULES[effectiveStrikes]

    return {
        action: rule.action,
        cooldownSeconds: rule.cooldownHours * 60 * 60,
        forfeitFunds: rule.forfeitFunds,
        trustPenalty: rule.trustPenalty,
        message: rule.message,
    }
}

/**
 * Check if user should be banned (3+ strikes)
 */
export function shouldBanUser(strikeCount: number): boolean {
    return strikeCount >= 3
}

/**
 * Format slash amount for display
 */
export function formatSlashAmount(amount: number): string {
    return `$${amount.toFixed(2)} USDC`
}

/**
 * Get cooldown end time
 */
export function getCooldownEndTime(cooldownSeconds: number): Date | null {
    if (cooldownSeconds === Infinity) return null // Permanent ban
    return new Date(Date.now() + cooldownSeconds * 1000)
}
