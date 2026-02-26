import { getRedis, useRedis } from "@/lib/redis"

/**
 * Redis-backed Order Store
 * 
 * WHY: Vercel serverless functions run on independent instances.
 * An in-memory Map on one instance is invisible to another.
 * Redis (Upstash) is shared across ALL instances.
 * 
 * Free tier: 10K commands/day — plenty for a hackathon.
 * Setup: https://console.upstash.com → Create Redis DB → copy REST URL + Token
 */

export interface Order {
    id: string
    type: "buy" | "sell"
    status: "created" | "matched" | "payment_pending" | "payment_sent" | "completed" | "disputed" | "mediation" | "cancelled" | "expired" | "settled" | "verifying"
    userId: string
    userAddress: string
    amountUsdc: number
    amountFiat: number
    fiatCurrency: string
    paymentMethod: string
    paymentDetails: string
    qrImage?: string
    lpPaymentProof?: string
    createdAt: number
    expiresAt: number
    matchedAt?: number
    solverId?: string
    solverAddress?: string
    paymentSentAt?: number
    disputePeriodEndsAt?: number
    stakeLockExpiresAt?: number
    completedAt?: number
    settledAt?: number
    meetLink?: string
    mediationScheduledAt?: number
    mediationEmail?: string
    disputeReason?: string
}

// ─── In-memory fallback (dev only) ─────────────────────
const globalForMemory = globalThis as unknown as { _uwuOrdersFallback?: Map<string, Order> }
if (!globalForMemory._uwuOrdersFallback) {
    globalForMemory._uwuOrdersFallback = new Map()
}
const memoryStore = globalForMemory._uwuOrdersFallback

// Redis key helpers
const ORDER_KEY = (id: string) => `order:${id}`
const ORDER_INDEX_KEY = "order:index" // sorted set of order IDs by createdAt

// ─── Order Store API ────────────────────────────────────

/**
 * Get a single order by ID
 */
export async function getOrder(id: string): Promise<Order | null> {
    if (!useRedis()) {
        return memoryStore.get(id) || null
    }

    try {
        const order = await getRedis().get<Order>(ORDER_KEY(id))
        return order
    } catch (error) {
        console.error('[OrderStore] Failed to get order:', error)
        return memoryStore.get(id) || null
    }
}

/**
 * Save/update an order
 */
export async function setOrder(order: Order): Promise<void> {
    // Always update memory (for SSE broadcast on same instance)
    memoryStore.set(order.id, order)

    if (!useRedis()) return

    try {
        const redis = getRedis()
        // Store order data with 24h TTL (orders older than that are useless)
        await redis.set(ORDER_KEY(order.id), order, { ex: 86400 })
        // Add to sorted index by createdAt for range queries
        await redis.zadd(ORDER_INDEX_KEY, { score: order.createdAt, member: order.id })
    } catch (error) {
        console.error('[OrderStore] Failed to set order:', error)
    }
}

/**
 * Delete an order
 */
export async function deleteOrder(id: string): Promise<void> {
    memoryStore.delete(id)

    if (!useRedis()) return

    try {
        const redis = getRedis()
        await redis.del(ORDER_KEY(id))
        await redis.zrem(ORDER_INDEX_KEY, id)
    } catch (error) {
        console.error('[OrderStore] Failed to delete order:', error)
    }
}

/**
 * Get all orders (with optional filters)
 */
export async function getAllOrders(filters?: {
    status?: string
    type?: string
    userId?: string
    solverId?: string
}): Promise<Order[]> {
    if (!useRedis()) {
        let orders = Array.from(memoryStore.values())
        return applyFilters(orders, filters)
    }

    try {
        const redis = getRedis()
        // Get all order IDs from sorted set (most recent first)
        const orderIds = await redis.zrange(ORDER_INDEX_KEY, 0, -1, { rev: true }) as string[]

        if (orderIds.length === 0) return []

        // Fetch all orders in parallel using pipeline
        const pipeline = redis.pipeline()
        for (const id of orderIds) {
            pipeline.get<Order>(ORDER_KEY(id))
        }
        const results = await pipeline.exec<(Order | null)[]>()

        let orders = results.filter((o): o is Order => o !== null)

        // Clean up expired from index
        const expiredIds = orderIds.filter((_, i) => results[i] === null)
        if (expiredIds.length > 0) {
            const cleanupPipeline = redis.pipeline()
            for (const id of expiredIds) {
                cleanupPipeline.zrem(ORDER_INDEX_KEY, id)
            }
            cleanupPipeline.exec().catch(() => {})
        }

        return applyFilters(orders, filters)
    } catch (error) {
        console.error('[OrderStore] Failed to get all orders:', error)
        // Fallback to memory
        return applyFilters(Array.from(memoryStore.values()), filters)
    }
}

/**
 * Delete all orders for a user
 */
export async function deleteOrdersForUser(userId: string): Promise<number> {
    const allOrders = await getAllOrders()
    let deleted = 0

    for (const order of allOrders) {
        if (order.userId === userId || order.solverId === userId) {
            await deleteOrder(order.id)
            deleted++
        }
    }

    return deleted
}

// ─── Helpers ────────────────────────────────────────────

function applyFilters(orders: Order[], filters?: {
    status?: string
    type?: string
    userId?: string
    solverId?: string
}): Order[] {
    if (!filters) return orders

    if (filters.status) {
        orders = orders.filter(o => o.status === filters.status)
    }
    if (filters.type) {
        orders = orders.filter(o => o.type === filters.type)
    }
    if (filters.userId) {
        const uid = filters.userId.toLowerCase()
        orders = orders.filter(o =>
            o.userId === filters.userId ||
            o.userAddress?.toLowerCase() === uid ||
            o.solverAddress?.toLowerCase() === uid
        )
    }
    if (filters.solverId) {
        orders = orders.filter(o => o.solverId === filters.solverId)
    }

    return orders
}
