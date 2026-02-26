import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/users/[address]/cooldown
 * Returns user's current cooldown status
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    const { address } = await params
    
    try {
        // In production, this would query the smart contract
        // For now, return mock data
        
        // Mock: No cooldown for most users
        const mockCooldown = {
            isOnCooldown: false,
            cooldownUntil: null,
            reason: null
        }
        
        // Example: Simulate new account cooldown
        // const newAccountCooldown = {
        //     isOnCooldown: true,
        //     cooldownUntil: Date.now() + 10 * 60 * 1000, // 10 min
        //     reason: 'new_account'
        // }
        
        return NextResponse.json(mockCooldown)
        
    } catch (error) {
        console.error('Error fetching cooldown:', error)
        return NextResponse.json(
            { error: 'Failed to fetch cooldown status' },
            { status: 500 }
        )
    }
}
