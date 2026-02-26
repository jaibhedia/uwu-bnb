import { Redis } from "@upstash/redis"

/**
 * Shared Redis client singleton.
 * All stores (orders, validations, LP, fraud, payment) import from here.
 * One connection, reused across hot reloads and all modules.
 */

const g = globalThis as unknown as { _uwuRedis?: Redis }

export function getRedis(): Redis {
    if (!g._uwuRedis) {
        const url = process.env.UPSTASH_REDIS_REST_URL
        const token = process.env.UPSTASH_REDIS_REST_TOKEN
        if (!url || !token) {
            console.warn('[Redis] ⚠️  UPSTASH env vars missing — falling back to in-memory')
            return null as any
        }
        g._uwuRedis = new Redis({ url, token })
    }
    return g._uwuRedis
}

export function useRedis(): boolean {
    return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}
