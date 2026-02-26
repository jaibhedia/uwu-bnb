import { getRedis, useRedis } from "@/lib/redis"

/**
 * Redis-backed Validation Store
 * 
 * Same pattern as order-store.ts — shared across all Vercel instances.
 * Stores validation tasks and validator profiles in Upstash Redis.
 */

// ─── Types ──────────────────────────────────────────────

export interface ValidationVote {
    validator: string
    decision: 'approve' | 'flag'
    notes?: string
    votedAt: number
}

export interface ValidationTask {
    id: string
    orderId: string
    status: 'pending' | 'approved' | 'flagged' | 'escalated' | 'auto_approved'
    evidence: {
        userQrImage?: string
        userAddress: string
        lpScreenshot?: string
        lpAddress: string
        amountUsdc: number
        amountFiat: number
        fiatCurrency: string
        paymentMethod: string
    }
    votes: ValidationVote[]
    threshold: number
    createdAt: number
    deadline: number
    resolvedAt?: number
    resolvedBy?: string
}

export interface ValidatorProfile {
    address: string
    totalReviews: number
    totalEarned: number
    approvals: number
    flags: number
    accuracy: number
    lastReviewAt?: number
    // Stake management
    staked: number           // Total USDC staked (e.g. 100)
    lockedAmount: number     // Amount currently locked in active validations
    lockedOrders: { orderId: string; amount: number; lockedUntil: number }[]  // Per-txn locks
    isSlashed: boolean       // True = fully slashed, banned
    isActive: boolean        // Can accept validations
    registeredAt?: number    // When they registered as validator
}

// ─── In-memory fallback ─────────────────────────────────
const globalForMemory = globalThis as unknown as {
    _uwuValTasks?: Map<string, ValidationTask>
    _uwuValProfiles?: Map<string, ValidatorProfile>
    _uwuValCounter?: number
}
if (!globalForMemory._uwuValTasks) globalForMemory._uwuValTasks = new Map()
if (!globalForMemory._uwuValProfiles) globalForMemory._uwuValProfiles = new Map()
if (globalForMemory._uwuValCounter === undefined) globalForMemory._uwuValCounter = 0

const memTasks = globalForMemory._uwuValTasks
const memProfiles = globalForMemory._uwuValProfiles

// ─── Redis key helpers ──────────────────────────────────
const VAL_KEY = (id: string) => `val:${id}`
const VAL_INDEX = "val:index"                     // sorted set by createdAt
const VAL_COUNTER = "val:counter"                 // atomic counter
const PROFILE_KEY = (addr: string) => `valprofile:${addr.toLowerCase()}`
const PROFILE_INDEX = "valprofile:index"           // set of all profile addresses

// ─── Validation Task CRUD ───────────────────────────────

export async function getNextTaskId(): Promise<string> {
    if (!useRedis()) {
        globalForMemory._uwuValCounter = (globalForMemory._uwuValCounter || 0) + 1
        return `val-${globalForMemory._uwuValCounter}-${Date.now()}`
    }
    try {
        const counter = await getRedis().incr(VAL_COUNTER)
        return `val-${counter}-${Date.now()}`
    } catch {
        const fallback = Date.now()
        return `val-${fallback}-${Math.random().toString(36).slice(2, 6)}`
    }
}

export async function getValidationTask(id: string): Promise<ValidationTask | null> {
    if (!useRedis()) return memTasks.get(id) || null
    try {
        return await getRedis().get<ValidationTask>(VAL_KEY(id))
    } catch (error) {
        console.error('[ValStore] Failed to get task:', error)
        return memTasks.get(id) || null
    }
}

export async function setValidationTask(task: ValidationTask): Promise<void> {
    memTasks.set(task.id, task)
    if (!useRedis()) return
    try {
        const redis = getRedis()
        await redis.set(VAL_KEY(task.id), task, { ex: 7 * 86400 }) // 7-day TTL
        await redis.zadd(VAL_INDEX, { score: task.createdAt, member: task.id })
    } catch (error) {
        console.error('[ValStore] Failed to set task:', error)
    }
}

export async function getAllValidationTasks(filters?: {
    status?: string
    excludeAddress?: string
    includeResolved?: boolean
}): Promise<ValidationTask[]> {
    if (!useRedis()) {
        let tasks = Array.from(memTasks.values())
        return applyTaskFilters(tasks, filters)
    }
    try {
        const redis = getRedis()
        const ids = await redis.zrange(VAL_INDEX, 0, -1, { rev: true }) as string[]
        if (ids.length === 0) return []

        const pipeline = redis.pipeline()
        for (const id of ids) pipeline.get<ValidationTask>(VAL_KEY(id))
        const results = await pipeline.exec<(ValidationTask | null)[]>()

        let tasks = results.filter((t): t is ValidationTask => t !== null)

        // Clean up expired keys from index
        const expiredIds = ids.filter((_, i) => results[i] === null)
        if (expiredIds.length > 0) {
            const cp = redis.pipeline()
            for (const id of expiredIds) cp.zrem(VAL_INDEX, id)
            cp.exec().catch(() => { })
        }

        return applyTaskFilters(tasks, filters)
    } catch (error) {
        console.error('[ValStore] Failed to get all tasks:', error)
        return applyTaskFilters(Array.from(memTasks.values()), filters)
    }
}

function applyTaskFilters(tasks: ValidationTask[], filters?: {
    status?: string
    excludeAddress?: string
    includeResolved?: boolean
}): ValidationTask[] {
    if (!filters) return tasks
    if (!filters.includeResolved) {
        tasks = tasks.filter(t => t.status === 'pending')
    }
    if (filters.status) {
        tasks = tasks.filter(t => t.status === filters.status)
    }
    if (filters.excludeAddress) {
        const addr = filters.excludeAddress.toLowerCase()
        tasks = tasks.filter(t =>
            t.evidence.userAddress.toLowerCase() !== addr &&
            t.evidence.lpAddress.toLowerCase() !== addr
        )
    }
    return tasks
}

// ─── Validator Profile CRUD ─────────────────────────────

export async function getValidatorProfile(address: string): Promise<ValidatorProfile | null> {
    const addr = address.toLowerCase()
    if (!useRedis()) return memProfiles.get(addr) || null
    try {
        return await getRedis().get<ValidatorProfile>(PROFILE_KEY(addr))
    } catch (error) {
        console.error('[ValStore] Failed to get profile:', error)
        return memProfiles.get(addr) || null
    }
}

export async function setValidatorProfile(profile: ValidatorProfile): Promise<void> {
    const addr = profile.address.toLowerCase()
    memProfiles.set(addr, profile)
    if (!useRedis()) return
    try {
        const redis = getRedis()
        await redis.set(PROFILE_KEY(addr), profile, { ex: 30 * 86400 }) // 30-day TTL
        await redis.sadd(PROFILE_INDEX, addr)
    } catch (error) {
        console.error('[ValStore] Failed to set profile:', error)
    }
}

export async function getAllValidatorProfiles(): Promise<ValidatorProfile[]> {
    if (!useRedis()) return Array.from(memProfiles.values())
    try {
        const redis = getRedis()
        const addrs = await redis.smembers(PROFILE_INDEX) as string[]
        if (addrs.length === 0) return []

        const pipeline = redis.pipeline()
        for (const addr of addrs) pipeline.get<ValidatorProfile>(PROFILE_KEY(addr))
        const results = await pipeline.exec<(ValidatorProfile | null)[]>()
        return results.filter((p): p is ValidatorProfile => p !== null)
    } catch (error) {
        console.error('[ValStore] Failed to get all profiles:', error)
        return Array.from(memProfiles.values())
    }
}
