import { NextRequest, NextResponse } from "next/server"
import { getAllOrders } from "@/lib/order-store"

// Mock LP pool
const liquidityProviders = [
    { address: "0x1234...5678", stake: 500, rate: 1.001, available: true },
    { address: "0x2345...6789", stake: 250, rate: 1.002, available: true },
    { address: "0x3456...7890", stake: 100, rate: 0.999, available: true },
    { address: "0x4567...8901", stake: 450, rate: 0.998, available: true },
]

/**
 * Calculate LP's locked stake from orders within 24hr window
 * Orders completed in last 24hrs still have their stake locked
 */
export async function calculateLockedStake(lpAddress: string): Promise<number> {
    const now = Date.now()
    let lockedAmount = 0
    
    const orders = await getAllOrders()
    for (const order of orders) {
        if (order.solverAddress?.toLowerCase() !== lpAddress.toLowerCase()) continue
        
        // Orders still in progress lock their full amount
        if (["matched", "payment_pending", "verifying"].includes(order.status)) {
            lockedAmount += order.amountUsdc
        }
        
        // Completed orders within 24hr window still lock stake
        if (order.status === "completed" && order.stakeLockExpiresAt && order.stakeLockExpiresAt > now) {
            lockedAmount += order.amountUsdc
        }
    }
    
    return lockedAmount
}

export async function POST(request: NextRequest) {
    const body = await request.json()
    const { amount, type } = body

    // Simulate AI matching logic
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // High value orders get premium LPs
    const isHighValue = amount >= 500

    let matchedLP
    if (isHighValue) {
        // Find LP with highest stake
        matchedLP = liquidityProviders
            .filter(lp => lp.available && lp.stake >= amount / 2)
            .sort((a, b) => b.stake - a.stake)[0]
    } else {
        // Use baseline pooled liquidity
        matchedLP = {
            address: "POOL_BASELINE",
            stake: 10000,
            rate: type === "buy" ? 1.001 : 0.999,
            available: true,
        }
    }

    return NextResponse.json({
        success: true,
        matched: matchedLP || null,
        isHighValue,
        estimatedRate: matchedLP?.rate || 1.0,
        message: matchedLP
            ? `Matched with LP ${matchedLP.address}`
            : "No suitable LP found",
    })
}

export async function GET(request: NextRequest) {
    const lpAddress = request.nextUrl.searchParams.get("lpAddress")
    const totalStake = parseFloat(request.nextUrl.searchParams.get("totalStake") || "0")
    
    // If LP address provided, return their available stake
    if (lpAddress && totalStake > 0) {
        const lockedStake = await calculateLockedStake(lpAddress)
        const availableStake = Math.max(0, totalStake - lockedStake)
        
        return NextResponse.json({
            success: true,
            lpAddress,
            totalStake,
            lockedStake,
            availableStake,
            canAcceptOrder: (orderAmount: number) => orderAmount <= availableStake,
        })
    }
    
    return NextResponse.json({
        providers: liquidityProviders,
        totalLiquidity: liquidityProviders.reduce((sum, lp) => sum + lp.stake, 0),
    })
}
