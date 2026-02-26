import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/lp/active
 * Returns list of active LPs with their stats for round-robin selection
 */
export async function GET(request: NextRequest) {
    try {
        // In production, this would query the smart contract
        // For now, return mock data that matches our LP rotation requirements
        
        // Mock active LPs (would come from contract's getActiveLPList())
        const mockLPs = [
            {
                address: '0x1234567890123456789012345678901234567890',
                name: 'LP Alpha',
                stake: 250_000000, // $250 USDC
                tier: 3,
                availableLiquidity: 200_000000, // $200 available
                dailyLimitRemaining: 180_000000, // $180 remaining today
                avgCompletionTime: 180, // 3 minutes
                totalTrades: 47,
                isActive: true,
                lastOrderTime: Date.now() - 120000, // 2 min ago
                cooldownUntil: 0
            },
            {
                address: '0x2345678901234567890123456789012345678901',
                name: 'LP Beta',
                stake: 500_000000, // $500 USDC
                tier: 4,
                availableLiquidity: 450_000000, // $450 available
                dailyLimitRemaining: 320_000000, // $320 remaining today
                avgCompletionTime: 240, // 4 minutes
                totalTrades: 128,
                isActive: true,
                lastOrderTime: Date.now() - 300000, // 5 min ago
                cooldownUntil: 0
            },
            {
                address: '0x3456789012345678901234567890123456789012',
                name: 'LP Gamma',
                stake: 100_000000, // $100 USDC
                tier: 2,
                availableLiquidity: 100_000000, // $100 available
                dailyLimitRemaining: 50_000000, // $50 remaining today
                avgCompletionTime: 150, // 2.5 minutes
                totalTrades: 23,
                isActive: true,
                lastOrderTime: Date.now() - 60000, // 1 min ago (on cooldown)
                cooldownUntil: 0
            },
            {
                address: '0x4567890123456789012345678901234567890123',
                name: 'LP Delta',
                stake: 1000_000000, // $1000 USDC
                tier: 5,
                availableLiquidity: 750_000000, // $750 available
                dailyLimitRemaining: 600_000000, // $600 remaining today
                avgCompletionTime: 120, // 2 minutes
                totalTrades: 256,
                isActive: true,
                lastOrderTime: Date.now() - 600000, // 10 min ago
                cooldownUntil: 0
            }
        ]

        return NextResponse.json({
            success: true,
            lps: mockLPs,
            totalActive: mockLPs.filter(lp => lp.isActive).length,
            timestamp: Date.now()
        })

    } catch (error) {
        console.error('Error fetching active LPs:', error)
        return NextResponse.json(
            { error: 'Failed to fetch active LPs' },
            { status: 500 }
        )
    }
}
