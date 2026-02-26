/**
 * Rate Lock Utility
 * 
 * Freezes exchange rate at order creation time to prevent:
 * - Rate manipulation during order
 * - Disputes over rate changes
 * - User/LP gaming rate fluctuations
 */

export interface LockedRate {
    rate: number           // INR per USDC (e.g., 83.50)
    lockedAt: number       // Timestamp when locked
    source: string         // Rate source (e.g., 'coingecko')
    validUntil: number     // Rate validity window
}

export interface RateQuote {
    usdcAmount: number     // USDC amount (6 decimals)
    inrAmount: number      // INR amount
    rate: number           // Locked rate
    fee: number            // Platform fee in USDC
    totalUsdc: number      // Total USDC needed (amount + fee)
    lockedAt: number
    expiresAt: number      // Quote expiration
}

// Rate is valid for 5 minutes after locking
const RATE_VALIDITY_WINDOW = 5 * 60 * 1000 // 5 minutes

// Rate precision (multiply by this for contract storage)
export const RATE_PRECISION = 1_000000 // 6 decimals

/**
 * Lock rate for an order
 */
export async function lockRate(): Promise<LockedRate> {
    try {
        // Fetch current rate from CoinGecko
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr',
            { next: { revalidate: 30 } } // Cache for 30 seconds
        )
        
        if (!response.ok) {
            throw new Error('Failed to fetch rate')
        }
        
        const data = await response.json()
        const rate = data['usd-coin']?.inr
        
        if (!rate) {
            throw new Error('Rate not available')
        }
        
        const now = Date.now()
        
        return {
            rate,
            lockedAt: now,
            source: 'coingecko',
            validUntil: now + RATE_VALIDITY_WINDOW
        }
    } catch (error) {
        console.error('Error locking rate:', error)
        
        // Fallback rate (should not be used in production)
        return {
            rate: 83.50,
            lockedAt: Date.now(),
            source: 'fallback',
            validUntil: Date.now() + RATE_VALIDITY_WINDOW
        }
    }
}

/**
 * Create a rate quote for an order
 */
export async function createRateQuote(
    usdcAmount: number,
    feePercentage: number = 0.5,
    smallOrderThreshold: number = 10_000000,
    smallOrderFee: number = 120000
): Promise<RateQuote> {
    const lockedRate = await lockRate()
    
    // Calculate INR amount
    const inrAmount = (usdcAmount / 1_000000) * lockedRate.rate
    
    // Calculate fee
    let fee = Math.floor((usdcAmount * feePercentage) / 100)
    
    // Add small order fee if applicable
    if (usdcAmount < smallOrderThreshold) {
        fee += smallOrderFee
    }
    
    return {
        usdcAmount,
        inrAmount: Math.round(inrAmount * 100) / 100, // Round to 2 decimals
        rate: lockedRate.rate,
        fee,
        totalUsdc: usdcAmount + fee,
        lockedAt: lockedRate.lockedAt,
        expiresAt: lockedRate.validUntil
    }
}

/**
 * Check if a locked rate is still valid
 */
export function isRateValid(lockedRate: LockedRate): boolean {
    return Date.now() < lockedRate.validUntil
}

/**
 * Convert rate to contract format (multiply by RATE_PRECISION)
 */
export function rateToContract(rate: number): bigint {
    return BigInt(Math.round(rate * RATE_PRECISION))
}

/**
 * Convert rate from contract format
 */
export function rateFromContract(contractRate: bigint): number {
    return Number(contractRate) / RATE_PRECISION
}

/**
 * Format rate for display
 */
export function formatRate(rate: number): string {
    return `₹${rate.toFixed(2)}`
}

/**
 * Calculate INR amount from USDC using locked rate
 */
export function calculateINR(usdcAmount: number, rate: number): number {
    return (usdcAmount / 1_000000) * rate
}

/**
 * Calculate USDC amount from INR using locked rate
 */
export function calculateUSDC(inrAmount: number, rate: number): number {
    return Math.round((inrAmount / rate) * 1_000000)
}

/**
 * Format time remaining for rate validity
 */
export function formatRateValidity(expiresAt: number): string {
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) return 'Expired'
    
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
}

/**
 * Get rate change indicator
 */
export function getRateChangeIndicator(
    currentRate: number,
    lockedRate: number
): { direction: 'up' | 'down' | 'stable', percentage: number } {
    const change = ((currentRate - lockedRate) / lockedRate) * 100
    
    if (Math.abs(change) < 0.1) {
        return { direction: 'stable', percentage: 0 }
    }
    
    return {
        direction: change > 0 ? 'up' : 'down',
        percentage: Math.abs(change)
    }
}
