import { NextRequest, NextResponse } from "next/server"
import { getAllOrders } from "@/lib/order-store"
import { getAllValidationTasks } from "@/lib/validation-store"

/**
 * Revenue & Platform Analytics API
 * 
 * GET /api/admin/revenue
 * 
 * Shows:
 * - Fee collection summary (calculated from completed orders)
 * - Order volume breakdown by status
 * - 7-day daily volume
 * - Validator payout tracking
 * 
 * Fee flow in the escrow contract:
 *   createEscrow: user pays (amount + 0.5% fee)
 *   releaseEscrow: amount → LP, fee → contract owner()
 *   
 * The contract owner receives all platform fees on-chain.
 * NEXT_PUBLIC_FEE_COLLECTOR in .env should match the contract deployer/owner.
 */

const CORE_TEAM = (
    process.env.NEXT_PUBLIC_CORE_TEAM || ""
).split(',').map(a => a.trim().toLowerCase()).filter(Boolean)

const FEE_COLLECTOR = process.env.NEXT_PUBLIC_FEE_COLLECTOR || "0xC7d7722a69bE1301A558418b6Da0aceEe4856857"
const PLATFORM_FEE_BPS = 50 // 0.5% — matches contract's platformFeeBps
const VALIDATOR_REWARD = 0.05 // $0.05 per review
const SMALL_ORDER_FEE = 0.125 // flat fee for orders < $10
const SMALL_ORDER_THRESHOLD = 10

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    // Auth check — only core team
    if (!address || !CORE_TEAM.includes(address.toLowerCase())) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
    }

    try {
        const [allOrders, allTasks] = await Promise.all([
            getAllOrders(),
            getAllValidationTasks({ includeResolved: true }),
        ])

        // ─── Order breakdown ────────────────────────────
        const statusBreakdown: Record<string, number> = {}
        allOrders.forEach(o => {
            statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1
        })

        const completedOrders = allOrders.filter(o =>
            o.status === "completed" || o.status === "settled"
        )
        const pendingOrders = allOrders.filter(o =>
            o.status === "created" || o.status === "matched" || o.status === "payment_pending" || o.status === "payment_sent" || o.status === "verifying"
        )
        const failedOrders = allOrders.filter(o =>
            o.status === "cancelled" || o.status === "expired"
        )

        // ─── Fee calculations ───────────────────────────
        const totalVolume = completedOrders.reduce((sum, o) => sum + (o.amountUsdc || 0), 0)
        const protocolFees = (totalVolume * PLATFORM_FEE_BPS) / 10000 // 0.5%
        const smallOrderCount = completedOrders.filter(o => (o.amountUsdc || 0) < SMALL_ORDER_THRESHOLD).length
        const smallOrderFees = smallOrderCount * SMALL_ORDER_FEE

        // ─── Validator payouts ──────────────────────────
        const totalVotes = allTasks.reduce((sum, t) => sum + t.votes.length, 0)
        const totalValidatorPayouts = totalVotes * VALIDATOR_REWARD

        // ─── 7-day daily volume ─────────────────────────
        const now = Date.now()
        const dailyVolume: { date: string; volume: number; orders: number; fees: number }[] = []
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(now - i * 86400000)
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(dayStart.getTime() + 86400000)
            const dateStr = dayStart.toISOString().split("T")[0]

            const dayOrders = completedOrders.filter(o => {
                const ts = o.completedAt || o.settledAt || o.createdAt
                return ts >= dayStart.getTime() && ts < dayEnd.getTime()
            })
            const dayVol = dayOrders.reduce((sum, o) => sum + (o.amountUsdc || 0), 0)

            dailyVolume.push({
                date: dateStr,
                volume: dayVol,
                orders: dayOrders.length,
                fees: (dayVol * PLATFORM_FEE_BPS) / 10000,
            })
        }

        // ─── All-time order history (last 50) ───────────
        const recentOrders = allOrders
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 50)
            .map(o => ({
                id: o.id,
                type: o.type,
                status: o.status,
                amountUsdc: o.amountUsdc,
                amountFiat: o.amountFiat,
                fiatCurrency: o.fiatCurrency,
                userAddress: o.userAddress?.slice(0, 10) + "...",
                solverAddress: o.solverAddress ? o.solverAddress.slice(0, 10) + "..." : null,
                createdAt: o.createdAt,
                completedAt: o.completedAt,
                fee: o.status === "completed" || o.status === "settled"
                    ? ((o.amountUsdc * PLATFORM_FEE_BPS) / 10000)
                    : 0,
            }))

        // ─── Validation stats ───────────────────────────
        const validationStats = {
            total: allTasks.length,
            pending: allTasks.filter(t => t.status === "pending").length,
            approved: allTasks.filter(t => t.status === "approved").length,
            autoApproved: allTasks.filter(t => t.status === "auto_approved").length,
            escalated: allTasks.filter(t => t.status === "escalated").length,
            totalVotes,
            totalValidatorPayouts,
        }

        return NextResponse.json({
            success: true,
            feeCollector: FEE_COLLECTOR,
            feeNote: "Fees go to contract owner() on releaseEscrow. Ensure this matches your deployer wallet.",
            platformFeeBps: PLATFORM_FEE_BPS,
            revenue: {
                protocolFees: +protocolFees.toFixed(4),
                smallOrderFees: +smallOrderFees.toFixed(4),
                totalFees: +(protocolFees + smallOrderFees).toFixed(4),
                totalVolume: +totalVolume.toFixed(4),
                validatorPayouts: +totalValidatorPayouts.toFixed(4),
                netRevenue: +(protocolFees + smallOrderFees - totalValidatorPayouts).toFixed(4),
            },
            orders: {
                total: allOrders.length,
                completed: completedOrders.length,
                pending: pendingOrders.length,
                failed: failedOrders.length,
                statusBreakdown,
            },
            dailyVolume,
            recentOrders,
            validationStats,
            timestamp: new Date().toISOString(),
        })
    } catch (error: unknown) {
        console.error("[Revenue API] Error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to fetch revenue data" },
            { status: 500 }
        )
    }
}
