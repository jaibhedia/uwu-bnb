import { NextRequest, NextResponse } from "next/server"
import { createPublicClient, http } from "viem"
import { CONTRACT_ADDRESSES, opbnbTestnet } from "@/lib/web3-config"
import { getRedis, useRedis } from "@/lib/redis"

// BNB Chain (opBNB Testnet) for on-chain reads
const publicClient = createPublicClient({
    chain: opbnbTestnet,
    transport: http(),
})

// ABI for reading LP stakes from P2PEscrowV5
const STAKING_READ_ABI = [
    {
        inputs: [{ name: "", type: "address" }],
        name: "lpStakes",
        outputs: [
            { name: "amount", type: "uint256" },
            { name: "lockedInOrders", type: "uint256" },
            { name: "totalTrades", type: "uint256" },
            { name: "totalDisputes", type: "uint256" },
            { name: "disputesLost", type: "uint256" },
            { name: "memberSince", type: "uint256" },
            { name: "avgCompletionTime", type: "uint256" },
            { name: "cooldownUntil", type: "uint256" },
            { name: "lastOrderTime", type: "uint256" },
            { name: "dailyVolume", type: "uint256" },
            { name: "dailyVolumeDate", type: "uint256" },
            { name: "unstakeRequestTime", type: "uint256" },
            { name: "unstakeAmount", type: "uint256" },
            { name: "isActive", type: "bool" },
            { name: "isBanned", type: "bool" }
        ],
        stateMutability: "view",
        type: "function"
    }
] as const

// Minimum stake required to be LP (50 USDC = 50 * 1e6)
const MIN_LP_STAKE = BigInt(50_000_000)

// Redis key helpers
const LP_KEY = (addr: string) => `lp:${addr.toLowerCase()}`
const LP_INDEX = "lp:index" // set of all LP addresses

// In-memory fallback
type LPRecord = {
    address: string
    stake: number
    rate: number
    minOrder: number
    maxOrder: number
    paymentMethods: string[]
    isActive: boolean
    completedOrders: number
    rating: number
    registeredAt: number
}
const globalForLPs = globalThis as unknown as { _uwuLPs?: Map<string, LPRecord> }
if (!globalForLPs._uwuLPs) {
    globalForLPs._uwuLPs = new Map()
}
const memLPs = globalForLPs._uwuLPs

async function getLP(address: string): Promise<LPRecord | null> {
    const addr = address.toLowerCase()
    if (!useRedis()) return memLPs.get(addr) || null
    try {
        return await getRedis().get<LPRecord>(LP_KEY(addr))
    } catch {
        return memLPs.get(addr) || null
    }
}

async function setLP(record: LPRecord): Promise<void> {
    const addr = record.address.toLowerCase()
    memLPs.set(addr, record)
    if (!useRedis()) return
    try {
        const redis = getRedis()
        await redis.set(LP_KEY(addr), record, { ex: 30 * 86400 }) // 30-day TTL
        await redis.sadd(LP_INDEX, addr)
    } catch (e) {
        console.error('[LP] Redis set failed:', e)
    }
}

/**
 * Verify on-chain stake for LP registration
 */
async function verifyOnChainStake(address: string): Promise<{ valid: boolean; stake: number; error?: string }> {
    try {
        console.log("[LP] Verifying on-chain stake for:", address)
        console.log("[LP] Contract address:", CONTRACT_ADDRESSES.P2P_ESCROW)
        
        const result = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.P2P_ESCROW as `0x${string}`,
            abi: STAKING_READ_ABI,
            functionName: "lpStakes",
            args: [address as `0x${string}`],
        })

        // V5 LPStake struct: result[0] = amount
        const stakeAmount = result[0]
        const stakeInUsdc = Number(stakeAmount) / 1_000_000
        console.log("[LP] On-chain stake amount:", stakeInUsdc, "USDC (raw:", stakeAmount.toString(), ")")

        if (stakeAmount < MIN_LP_STAKE) {
            return {
                valid: false,
                stake: stakeInUsdc,
                error: `Insufficient stake. Required: 50 USDC, Found: ${stakeInUsdc.toFixed(2)} USDC. Please stake via the escrow contract first.`
            }
        }

        return { valid: true, stake: stakeInUsdc }
    } catch (error) {
        console.error("[LP] On-chain verification failed:", error)
        return {
            valid: false,
            stake: 0,
            error: "Failed to verify on-chain stake. Contract may not be deployed or address may be incorrect."
        }
    }
}

/**
 * POST /api/lp/register - Register as a Liquidity Provider
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { address, rate, minOrder, maxOrder, paymentMethods } = body

        if (!address) {
            return NextResponse.json(
                { success: false, error: "Address is required" },
                { status: 400 }
            )
        }

        // Check if already registered
        const existing = await getLP(address)
        if (existing) {
            return NextResponse.json(
                { success: false, error: "Already registered as LP" },
                { status: 400 }
            )
        }

        // Verify on-chain stake
        const stakeVerification = await verifyOnChainStake(address)
        
        if (!stakeVerification.valid) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: stakeVerification.error,
                    currentStake: stakeVerification.stake,
                    requiredStake: 50
                },
                { status: 400 }
            )
        }

        // Register LP with verified stake
        const lpRecord: LPRecord = {
            address: address.toLowerCase(),
            stake: stakeVerification.stake,
            rate: rate || 83.50,
            minOrder: minOrder || 10,
            maxOrder: maxOrder || 1000,
            paymentMethods: paymentMethods || ['UPI'],
            isActive: true,
            completedOrders: 0,
            rating: 100,
            registeredAt: Date.now()
        }
        await setLP(lpRecord)

        console.log(`[LP] Registered new LP: ${address} with stake: ${stakeVerification.stake} USDC`)

        return NextResponse.json({
            success: true,
            message: "Successfully registered as LP",
            lp: lpRecord
        })
    } catch (error) {
        console.error("[LP] Registration error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to register LP" },
            { status: 500 }
        )
    }
}

/**
 * GET /api/lp/register - Check LP registration status
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address) {
        return NextResponse.json(
            { success: false, error: "Address is required" },
            { status: 400 }
        )
    }

    const lp = await getLP(address)

    return NextResponse.json({
        success: true,
        isRegistered: !!lp,
        lp: lp || null
    })
}

/**
 * PATCH /api/lp/register - Update LP settings
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { address, rate, minOrder, maxOrder, paymentMethods, isActive } = body

        if (!address) {
            return NextResponse.json(
                { success: false, error: "Address is required" },
                { status: 400 }
            )
        }

        const lp = await getLP(address)
        if (!lp) {
            return NextResponse.json(
                { success: false, error: "Not registered as LP" },
                { status: 404 }
            )
        }

        // Update fields
        if (rate !== undefined) lp.rate = rate
        if (minOrder !== undefined) lp.minOrder = minOrder
        if (maxOrder !== undefined) lp.maxOrder = maxOrder
        if (paymentMethods !== undefined) lp.paymentMethods = paymentMethods
        if (isActive !== undefined) lp.isActive = isActive

        await setLP(lp)

        return NextResponse.json({
            success: true,
            message: "LP settings updated",
            lp
        })
    } catch (error) {
        console.error("[LP] Update error:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update LP settings" },
            { status: 500 }
        )
    }
}
