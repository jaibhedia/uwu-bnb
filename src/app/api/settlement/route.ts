import { NextResponse } from "next/server"
import { broadcastOrderUpdate } from "../orders/sse/route"
import { type Order, getOrder, setOrder, getAllOrders } from "@/lib/order-store"

/**
 * Settlement API
 * 
 * Handles settlement of orders after 24hr dispute period.
 * 
 * CORRECT FLOW:
 * - User (buyer) pays USDC to LP for INR
 * - LP pays INR to user's destination QR
 * - On settlement, user's USDC goes to LP
 * - LP profit is built into the exchange rate (not a separate reward)
 */

const DISPUTE_PERIOD_MS = 24 * 60 * 60 * 1000 // 24 hours

interface SettlementResult {
    orderId: string
    success: boolean
    usdcTransferred: number
    error?: string
}

/**
 * Process settlement for an order
 * User's USDC -> LP (for the INR the LP already paid)
 */
async function settleOrder(order: Order): Promise<SettlementResult> {
    try {
        console.log(`[Settlement] Processing order ${order.id}`)
        console.log(`[Settlement] User: ${order.userId} -> LP: ${order.solverId}`)
        console.log(`[Settlement] USDC: ${order.amountUsdc} transferred to LP`)

        // Simulate blockchain transaction delay
        await new Promise(resolve => setTimeout(resolve, 500))

        // Update order status
        order.status = "settled"
        order.settledAt = Date.now()
        await setOrder(order)

        // Broadcast update
        broadcastOrderUpdate(order, "settled")

        console.log(`[Settlement] Order ${order.id} settled - ${order.amountUsdc} USDC sent to LP`)

        return {
            orderId: order.id,
            success: true,
            usdcTransferred: order.amountUsdc,
        }
    } catch (error) {
        console.error(`[Settlement] Failed to settle order ${order.id}:`, error)
        return {
            orderId: order.id,
            success: false,
            usdcTransferred: 0,
            error: String(error),
        }
    }
}

/**
 * GET /api/settlement
 * Check and settle all eligible orders
 */
export async function GET() {
    const now = Date.now()
    const results: SettlementResult[] = []

    const allOrders = await getAllOrders()
    for (const order of allOrders) {
        // Check if order is ready for settlement
        if (
            order.status === "payment_sent" &&
            order.disputePeriodEndsAt &&
            order.disputePeriodEndsAt <= now
        ) {
            const result = await settleOrder(order)
            results.push(result)
        }
    }

    return NextResponse.json({
        success: true,
        settled: results.filter(r => r.success).length,
        results,
    })
}

/**
 * POST /api/settlement
 * Manually settle a specific order (for testing or admin use)
 */
export async function POST(request: Request) {
    try {
        const { orderId, skipDispute } = await request.json()

        if (!orderId) {
            return NextResponse.json(
                { success: false, error: "Missing orderId" },
                { status: 400 }
            )
        }

        const order = await getOrder(orderId)
        if (!order) {
            return NextResponse.json(
                { success: false, error: "Order not found" },
                { status: 404 }
            )
        }

        // Check order status
        if (order.status !== "payment_sent") {
            return NextResponse.json(
                { success: false, error: `Cannot settle order with status: ${order.status}` },
                { status: 400 }
            )
        }

        // Check dispute period (unless skipping for testing)
        const now = Date.now()
        if (!skipDispute && order.disputePeriodEndsAt && order.disputePeriodEndsAt > now) {
            const remainingMs = order.disputePeriodEndsAt - now
            const remainingHrs = Math.ceil(remainingMs / (1000 * 60 * 60))
            return NextResponse.json(
                {
                    success: false,
                    error: `Dispute period not ended. ${remainingHrs}h remaining.`,
                    disputePeriodEndsAt: order.disputePeriodEndsAt,
                },
                { status: 400 }
            )
        }

        const result = await settleOrder(order)

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Order settled. ${result.usdcTransferred} USDC transferred to LP.`,
                usdcTransferred: result.usdcTransferred,
                order: await getOrder(orderId),
            })
        } else {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }
    } catch (error) {
        console.error("[Settlement] Error:", error)
        return NextResponse.json(
            { success: false, error: "Settlement failed" },
            { status: 500 }
        )
    }
}
