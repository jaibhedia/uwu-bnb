import { NextRequest } from "next/server"
import { getAllOrders, type Order } from "@/lib/order-store"

// Re-export the Order type so other files can import from here
export type { Order } from "@/lib/order-store"

/**
 * SSE connections are per-instance (in-memory) — that's expected.
 * Cross-instance order delivery is handled by polling from Redis.
 */
const globalForConnections = globalThis as unknown as {
    _uwuSolverConnections?: Map<string, ReadableStreamDefaultController>
}
if (!globalForConnections._uwuSolverConnections) {
    globalForConnections._uwuSolverConnections = new Map()
}
const solverConnections: Map<string, ReadableStreamDefaultController> = globalForConnections._uwuSolverConnections

/**
 * SSE Endpoint for Solver Order Feed
 */
export async function GET(request: NextRequest) {
    const solverId = request.nextUrl.searchParams.get("solverId")

    if (!solverId) {
        return new Response("Missing solverId parameter", { status: 400 })
    }

    const stream = new ReadableStream({
        async start(controller) {
            solverConnections.set(solverId, controller)

            // Send initial connection message
            const connectMessage = JSON.stringify({
                type: "connected",
                message: "Connected to order feed",
                timestamp: Date.now(),
            })
            controller.enqueue(`data: ${connectMessage}\n\n`)

            // Send current active orders FROM REDIS (not in-memory!)
            try {
                const activeOrders = await getAllOrders({ status: "created" })
                if (activeOrders.length > 0) {
                    const ordersMessage = JSON.stringify({
                        type: "active_orders",
                        orders: activeOrders.slice(0, 50),
                    })
                    controller.enqueue(`data: ${ordersMessage}\n\n`)
                }
            } catch (error) {
                console.error("[SSE] Failed to fetch active orders:", error)
            }

            // Keep-alive ping every 30 seconds
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(`data: ${JSON.stringify({ type: "ping", timestamp: Date.now() })}\n\n`)
                } catch {
                    clearInterval(pingInterval)
                }
            }, 30000)

            // Cleanup on disconnect
            request.signal.addEventListener("abort", () => {
                clearInterval(pingInterval)
                solverConnections.delete(solverId)
                controller.close()
            })
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    })
}

/**
 * Broadcast a new order to all connected solvers ON THIS INSTANCE
 * Cross-instance delivery is handled by solver polling from Redis
 */
export function broadcastOrder(order: Order) {
    const message = JSON.stringify({
        type: "new_order",
        order,
        timestamp: Date.now(),
    })

    solverConnections.forEach((controller, solverId) => {
        try {
            controller.enqueue(`data: ${message}\n\n`)
        } catch (error) {
            console.error(`Failed to send to solver ${solverId}:`, error)
            solverConnections.delete(solverId)
        }
    })
}

/**
 * Broadcast order update to all connected solvers ON THIS INSTANCE
 */
export function broadcastOrderUpdate(order: Order, updateType: string) {
    const message = JSON.stringify({
        type: "order_update",
        updateType,
        order,
        timestamp: Date.now(),
    })

    solverConnections.forEach((controller, solverId) => {
        try {
            controller.enqueue(`data: ${message}\n\n`)
        } catch (error) {
            console.error(`Failed to send update to solver ${solverId}:`, error)
            solverConnections.delete(solverId)
        }
    })
}

export { solverConnections }
