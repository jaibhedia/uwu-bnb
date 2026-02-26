import { NextRequest, NextResponse } from 'next/server'
import { FraudDetector, type OrderAnalysisData, type UserHistory } from '@/lib/fraud-detection'
import { getRedis, useRedis } from '@/lib/redis'

/**
 * Fraud Analysis API
 * POST /api/fraud/analyze
 * 
 * Analyzes trade risk before order creation
 */

// ── Redis-backed user history ────────────────────────────────────
const FRAUD_PREFIX = 'fraud:'
const FRAUD_INDEX  = 'fraud:index'
const FRAUD_TTL    = 60 * 60 * 24 * 30 // 30 days

function fraudKey(addr: string) { return `${FRAUD_PREFIX}${addr.toLowerCase()}` }

// In-memory fallback
const globalForFraud = globalThis as unknown as { _uwuFraud?: Map<string, UserHistory> }
if (!globalForFraud._uwuFraud) { globalForFraud._uwuFraud = new Map() }
const memFraud = globalForFraud._uwuFraud

const defaultHistory = (now = Date.now()): UserHistory => ({
    ordersLastHour: 0,
    ordersLast24h: 0,
    averageOrderAmount: 0,
    completedOrders: 0,
    totalVolume: 0,
    disputeCount: 0,
    walletCreatedAt: now - 7 * 24 * 60 * 60 * 1000,
})

async function getUserHistory(userAddress: string): Promise<UserHistory> {
    const addr = userAddress.toLowerCase()
    if (!useRedis()) return memFraud.get(addr) || defaultHistory()
    try {
        const raw = await getRedis().get<UserHistory>(fraudKey(addr))
        return raw || defaultHistory()
    } catch {
        return memFraud.get(addr) || defaultHistory()
    }
}

async function setUserHistoryRedis(userAddress: string, history: UserHistory) {
    const addr = userAddress.toLowerCase()
    memFraud.set(addr, history)
    if (!useRedis()) return
    try {
        const redis = getRedis()
        await redis.set(fraudKey(addr), history, { ex: FRAUD_TTL })
        await redis.sadd(FRAUD_INDEX, addr)
    } catch (e) {
        console.error('[Fraud] Redis set failed:', e)
    }
}

/**
 * Update user history after order
 */
export async function updateUserHistory(
    userAddress: string,
    orderAmount: number,
    completed: boolean = false,
    dispute: boolean = false
) {
    const history = await getUserHistory(userAddress)

    history.ordersLastHour++
    history.ordersLast24h++

    if (completed) {
        history.completedOrders++
        history.totalVolume += orderAmount
        history.averageOrderAmount = history.totalVolume / history.completedOrders
    }

    if (dispute) {
        history.disputeCount++
    }

    await setUserHistoryRedis(userAddress, history)
}

/**
 * Reset hourly counters (call via cron)
 */
export async function resetHourlyCounters() {
    if (!useRedis()) {
        memFraud.forEach(h => { h.ordersLastHour = 0 })
        return
    }
    try {
        const redis = getRedis()
        const addrs = await redis.smembers(FRAUD_INDEX)
        for (const addr of addrs) {
            const h = await redis.get<UserHistory>(fraudKey(addr))
            if (!h) continue
            h.ordersLastHour = 0
            await redis.set(fraudKey(addr), h, { ex: FRAUD_TTL })
        }
    } catch (e) {
        console.error('[Fraud] resetHourly failed:', e)
    }
}

/**
 * Reset daily counters (call via cron)
 */
export async function resetDailyCounters() {
    if (!useRedis()) {
        memFraud.forEach(h => { h.ordersLast24h = 0 })
        return
    }
    try {
        const redis = getRedis()
        const addrs = await redis.smembers(FRAUD_INDEX)
        for (const addr of addrs) {
            const h = await redis.get<UserHistory>(fraudKey(addr))
            if (!h) continue
            h.ordersLast24h = 0
            await redis.set(fraudKey(addr), h, { ex: FRAUD_TTL })
        }
    } catch (e) {
        console.error('[Fraud] resetDaily failed:', e)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { orderData, userAddress } = body

        if (!orderData || !userAddress) {
            return NextResponse.json(
                { success: false, error: 'Missing orderData or userAddress' },
                { status: 400 }
            )
        }

        // Get user history
        const userHistory = await getUserHistory(userAddress)

        // Get IP address from request headers
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
            request.headers.get('x-real-ip') ||
            'unknown'

        // Prepare order data for analysis
        const analysisData: OrderAnalysisData = {
            amountUsdc: orderData.amountUsdc,
            paymentMethod: orderData.paymentMethod || 'upi',
            fiatCurrency: orderData.fiatCurrency || 'INR',
            userAddress,
            ipAddress,
            deviceId: orderData.deviceId,
        }

        // Run fraud analysis
        const detector = new FraudDetector()
        const assessment = await detector.analyzeTrade(analysisData, userHistory)

        // Log the analysis (for monitoring)
        console.log(`[Fraud] Analysis for ${userAddress}:`, {
            riskScore: assessment.riskScore,
            riskLevel: assessment.riskLevel,
            blocked: assessment.blocked,
            actions: assessment.requiredActions,
        })

        return NextResponse.json({
            success: true,
            ...assessment,
        })
    } catch (error) {
        console.error('[Fraud] Analysis failed:', error)
        return NextResponse.json(
            { success: false, error: 'Fraud analysis failed' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/fraud/analyze?address=0x...
 * Get user's current risk profile
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address) {
        return NextResponse.json(
            { success: false, error: 'Missing address parameter' },
            { status: 400 }
        )
    }

    const history = await getUserHistory(address)

    return NextResponse.json({
        success: true,
        history,
    })
}
