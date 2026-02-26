import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/users/[address]/limits
 * Returns user's daily limits based on trust level
 * 
 * Trust Levels:
 * - New users: $150/day
 * - Established (50+ trades): $300/day
 * - High trust (100+ trades, 0 disputes): $750/day
 */

const DAILY_LIMITS = {
    new: 150_000000,          // $150 USDC
    established: 300_000000,   // $300 USDC
    high_trust: 750_000000     // $750 USDC
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    const { address } = await params
    
    try {
        // In production, this would query:
        // 1. Smart contract for user stats
        // 2. Calculate trust level
        // 3. Return daily limits
        
        // Mock user data based on address prefix (for testing)
        const isEstablished = address.startsWith('0x1')
        const isHighTrust = address.startsWith('0x2')
        
        let trustLevel: 'new' | 'established' | 'high_trust' = 'new'
        let completedOrders = 5
        let dailyUsed = 25_000000 // $25 used today
        
        if (isHighTrust) {
            trustLevel = 'high_trust'
            completedOrders = 150
            dailyUsed = 100_000000 // $100 used
        } else if (isEstablished) {
            trustLevel = 'established'
            completedOrders = 75
            dailyUsed = 50_000000 // $50 used
        }
        
        const dailyLimit = DAILY_LIMITS[trustLevel]
        const dailyRemaining = Math.max(0, dailyLimit - dailyUsed)
        
        // Calculate next reset (midnight UTC)
        const now = new Date()
        const tomorrow = new Date(now)
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        tomorrow.setUTCHours(0, 0, 0, 0)
        
        return NextResponse.json({
            address,
            trustLevel,
            completedOrders,
            dailyLimit,
            dailyUsed,
            dailyRemaining,
            canTrade: dailyRemaining > 0,
            nextResetAt: tomorrow.getTime(),
            limits: {
                new: DAILY_LIMITS.new,
                established: DAILY_LIMITS.established,
                high_trust: DAILY_LIMITS.high_trust
            }
        })
        
    } catch (error) {
        console.error('Error fetching user limits:', error)
        return NextResponse.json(
            { error: 'Failed to fetch user limits' },
            { status: 500 }
        )
    }
}
