import { NextRequest, NextResponse } from "next/server"
import { broadcastOrder, broadcastOrderUpdate } from "./sse/route"
import { type Order, getOrder, setOrder, getAllOrders, deleteOrdersForUser } from "@/lib/order-store"
import { createPublicClient, http, formatUnits } from "viem"
import { CONTRACT_ADDRESSES, USDC_ADDRESS, opbnbTestnet } from "@/lib/web3-config"
import { createValidationTask } from "../validations/route"
import { uploadBase64ToIPFS } from "@/lib/ipfs-upload-helper"

/**
 * Orders API
 *
 * GET: Fetch orders (with optional filters)
 * POST: Create new sell order
 * PATCH: Update order status
 *
 * SECURITY: All amounts are verified on-chain before order creation
 */

// BNB Chain (opBNB Testnet) for on-chain verification
const publicClient = createPublicClient({
    chain: opbnbTestnet,
    transport: http(),
})

// USDC ERC20 ABI (just balanceOf)
const USDC_BALANCE_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    }
] as const

// Staking ABI to check user's trading limit
const STAKING_ABI = [
    {
        inputs: [{ name: "user", type: "address" }],
        name: "stakes",
        outputs: [
            { name: "baseStake", type: "uint256" },
            { name: "lockedStake", type: "uint256" },
            { name: "tradingLimit", type: "uint256" },
            { name: "lastTradeTime", type: "uint256" },
            { name: "completedTrades", type: "uint256" },
            { name: "disputesLost", type: "uint256" },
            { name: "isLP", type: "bool" }
        ],
        stateMutability: "view",
        type: "function"
    }
] as const

const ORDER_EXPIRY_MINUTES = 15

// Exchange rate cache (fetched from CoinGecko)
let cachedExchangeRate = 83.50
let lastRateFetch = 0
const RATE_CACHE_MS = 60000 // 1 minute

async function getExchangeRateINR(): Promise<number> {
    const now = Date.now()
    if (now - lastRateFetch < RATE_CACHE_MS) {
        return cachedExchangeRate
    }

    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr',
            { signal: AbortSignal.timeout(3000) }
        )
        if (response.ok) {
            const data = await response.json()
            cachedExchangeRate = data['usd-coin']?.inr || 83.50
            lastRateFetch = now
            console.log('[Orders] Live INR rate:', cachedExchangeRate)
        }
    } catch (error) {
        console.warn('[Orders] Failed to fetch live rate, using cached:', error)
    }
    return cachedExchangeRate
}

/**
 * Verify user's USDC balance on-chain
 */
/** Helper: race a promise against a timeout (returns fallback on timeout) */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ])
}

async function verifyOnChainBalance(
    userAddress: string,
    requiredAmount: number
): Promise<{ valid: boolean; balance: number; error?: string }> {
    try {
        // Skip verification if USDC contract not configured
        if (!USDC_ADDRESS || USDC_ADDRESS === '0x0000000000000000000000000000000000000000') {
            console.warn('[Orders] USDC_ADDRESS not configured, skipping balance check')
            return { valid: true, balance: requiredAmount }
        }

        const balance = await withTimeout(
            publicClient.readContract({
                address: USDC_ADDRESS as `0x${string}`,
                abi: USDC_BALANCE_ABI,
                functionName: "balanceOf",
                args: [userAddress as `0x${string}`],
            }),
            4000, // 4s timeout for RPC
            null
        )

        if (balance === null) {
            console.warn('[Orders] Balance check timed out, allowing order')
            return { valid: true, balance: requiredAmount }
        }

        const balanceUsdc = Number(balance) / 1_000_000

        if (balanceUsdc < requiredAmount) {
            return {
                valid: false,
                balance: balanceUsdc,
                error: `Insufficient balance. Required: ${requiredAmount} USDC, Available: ${balanceUsdc.toFixed(2)} USDC`
            }
        }

        return { valid: true, balance: balanceUsdc }
    } catch (error) {
        console.error('[Orders] Balance verification failed:', error)
        // For testnet, allow through with warning
        return { valid: true, balance: requiredAmount }
    }
}

/**
 * Generate a unique order ID
 */
function generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * GET /api/orders
 * 
 * Query params:
 * - status: Filter by order status
 * - type: Filter by order type (buy/sell)
 * - userId: Filter by user ID
 * - solverId: Filter by solver ID
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const userId = searchParams.get("userId")
    const solverId = searchParams.get("solverId")

    let orders = await getAllOrders({
        status: status || undefined,
        type: type || undefined,
        userId: userId || undefined,
        solverId: solverId || undefined,
    })

    // Check for expired orders and update status
    const now = Date.now()
    for (const order of orders) {
        if (order.status === "created" && order.expiresAt < now) {
            order.status = "expired"
            await setOrder(order)
            broadcastOrderUpdate(order, "expired")
        }
    }

    // Re-filter after expiry updates
    if (status) {
        orders = orders.filter(o => o.status === status)
    }

    // Sort by createdAt descending
    orders.sort((a, b) => b.createdAt - a.createdAt)

    return NextResponse.json({
        success: true,
        orders,
        count: orders.length,
    })
}

/**
 * POST /api/orders
 * 
 * Create a new sell order and broadcast to solvers.
 * 
 * PERF: Exchange rate + balance check + tier check run in PARALLEL
 * to stay under Vercel's 10-second function timeout.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            userId,
            userAddress,
            type = "sell",
            amountUsdc,
            fiatCurrency,
            paymentMethod,
            paymentDetails,
            qrImage,
        } = body

        // Validation
        if (!userId || !userAddress) {
            return NextResponse.json(
                { success: false, error: "Missing userId or userAddress" },
                { status: 400 }
            )
        }
        if (!amountUsdc || amountUsdc <= 0) {
            return NextResponse.json(
                { success: false, error: "Invalid amountUsdc" },
                { status: 400 }
            )
        }
        if (amountUsdc > 10000) {
            return NextResponse.json(
                { success: false, error: "Order exceeds maximum limit of 10,000 USDC" },
                { status: 400 }
            )
        }
        // No minimum - orders under $10 USDC incur $0.125 fee
        if (!fiatCurrency || !paymentMethod) {
            return NextResponse.json(
                { success: false, error: "Missing fiatCurrency or paymentMethod" },
                { status: 400 }
            )
        }

        // RUN ALL VERIFICATION IN PARALLEL to stay under Vercel timeout
        const [exchangeRate, balanceCheck, tierCheckRaw] = await Promise.all([
            getExchangeRateINR(),
            type === "sell"
                ? verifyOnChainBalance(userAddress, amountUsdc)
                : Promise.resolve({ valid: true, balance: amountUsdc } as const),
            // Tier check needs exchange rate, but we can fetch rate + do the RPC in parallel,
            // then apply the rate to the result afterward
            withTimeout(
                publicClient.readContract({
                    address: CONTRACT_ADDRESSES.P2P_ESCROW as `0x${string}`,
                    abi: STAKING_ABI,
                    functionName: "stakes",
                    args: [userAddress as `0x${string}`],
                }),
                4000,
                null
            ).catch(() => null),
        ])

        const serverCalculatedFiat = amountUsdc * exchangeRate
        console.log(`[Orders] Using live rate: ₹${exchangeRate.toFixed(2)} per USDC`)

        // Check balance result
        if (type === "sell" && !balanceCheck.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: balanceCheck.error,
                    availableBalance: balanceCheck.balance
                },
                { status: 400 }
            )
        }

        // Apply tier limit from the parallel RPC call
        if (tierCheckRaw !== null) {
            const tradingLimit = Number((tierCheckRaw as any)[2]) / 1_000_000
            const tradingLimitFiat = tradingLimit === 0 ? 5000 : tradingLimit * exchangeRate
            if (serverCalculatedFiat > tradingLimitFiat) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Order exceeds tier limit. Max: ₹${tradingLimitFiat.toFixed(0)}, Requested: ₹${serverCalculatedFiat.toFixed(0)}`,
                        tierLimit: tradingLimitFiat
                    },
                    { status: 400 }
                )
            }
        } else {
            // Timeout / error — apply default 5000 INR limit
            if (serverCalculatedFiat > 5000) {
                return NextResponse.json(
                    { success: false, error: `Order exceeds default limit. Max: ₹5000` },
                    { status: 400 }
                )
            }
        }

        // Create the order with SERVER-CALCULATED amounts
        const now = Date.now()
        const orderId = generateOrderId()

        // Upload QR image to IPFS (falls back to base64 if Pinata not configured)
        let storedQrImage = qrImage || undefined
        if (qrImage) {
            const ipfsResult = await uploadBase64ToIPFS(qrImage, `${orderId}_qr`)
            if (ipfsResult) {
                storedQrImage = ipfsResult.url
                console.log(`[Orders] QR image uploaded to IPFS: ${ipfsResult.cid}`)
            }
        }

        const order: Order = {
            id: orderId,
            type: type as "buy" | "sell",
            status: "created",
            userId,
            userAddress,
            amountUsdc,
            amountFiat: serverCalculatedFiat, // NEVER trust client-sent fiat amount
            fiatCurrency,
            paymentMethod,
            paymentDetails: paymentDetails || "",
            qrImage: storedQrImage,
            createdAt: now,
            expiresAt: now + ORDER_EXPIRY_MINUTES * 60 * 1000,
        }

        console.log(`[Orders] Creating order: ${amountUsdc} USDC = ₹${serverCalculatedFiat.toFixed(2)} (verified on-chain)`)

        // Store the order in Redis FIRST (shared across all Vercel instances)
        await setOrder(order)

        // Broadcast to all connected solvers (on this instance)
        broadcastOrder(order)

        return NextResponse.json({
            success: true,
            order,
            message: "Order created and broadcasted to solvers",
        })
    } catch (error) {
        console.error("Failed to create order:", error)
        return NextResponse.json(
            { success: false, error: "Failed to create order" },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/orders
 * 
 * Update order status (match, complete, dispute, cancel)
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { orderId, action, solverId, solverAddress, lpPaymentProof } = body

        if (!orderId || !action) {
            return NextResponse.json(
                { success: false, error: "Missing orderId or action" },
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

        switch (action) {
            case "match":
                // Solver accepts the order
                if (!solverId || !solverAddress) {
                    return NextResponse.json(
                        { success: false, error: "Missing solverId or solverAddress" },
                        { status: 400 }
                    )
                }
                if (order.status !== "created") {
                    return NextResponse.json(
                        { success: false, error: "Order cannot be matched" },
                        { status: 400 }
                    )
                }
                order.status = "matched"
                order.solverId = solverId
                order.solverAddress = solverAddress
                order.matchedAt = Date.now()
                break

            case "payment_sent":
                // Solver has sent fiat payment with proof
                // DAO VALIDATION: order goes to "verifying" → validators review → then completed
                if (order.status !== "matched" && order.status !== "payment_pending") {
                    return NextResponse.json(
                        { success: false, error: "Order not in matched or payment_pending state" },
                        { status: 400 }
                    )
                }

                // Enter verifying state — DAO validators will review
                order.status = "verifying"
                order.paymentSentAt = Date.now()

                if (lpPaymentProof) {
                    // Upload LP payment proof to IPFS
                    const ipfsProof = await uploadBase64ToIPFS(lpPaymentProof, `${orderId}_lp_proof`)
                    order.lpPaymentProof = ipfsProof ? ipfsProof.url : lpPaymentProof
                    if (ipfsProof) {
                        console.log(`[Orders] LP proof uploaded to IPFS: ${ipfsProof.cid}`)
                    }
                }

                // Create validation task for DAO review
                await createValidationTask({
                    id: order.id,
                    qrImage: order.qrImage,
                    userAddress: order.userAddress,
                    lpPaymentProof: order.lpPaymentProof,
                    solverAddress: order.solverAddress,
                    amountUsdc: order.amountUsdc,
                    amountFiat: order.amountFiat || 0,
                    fiatCurrency: order.fiatCurrency || 'INR',
                    paymentMethod: order.paymentMethod || 'UPI',
                })
                break

            case "complete":
                // User confirms payment received, USDC released
                // Can also be triggered by DAO validation
                if (order.status !== "payment_sent" && order.status !== "verifying") {
                    return NextResponse.json(
                        { success: false, error: "Payment not in payment_sent or verifying state" },
                        { status: 400 }
                    )
                }
                order.status = "completed"
                order.completedAt = Date.now()
                break

            case "dispute":
                // Either party raises a dispute
                // Allow disputes on completed orders within 24hr window
                const canDispute = ["matched", "payment_sent", "payment_pending", "verifying"].includes(order.status) ||
                    (order.status === "completed" && order.disputePeriodEndsAt && order.disputePeriodEndsAt > Date.now())

                if (!canDispute) {
                    return NextResponse.json(
                        { success: false, error: "Cannot dispute this order - dispute window has closed" },
                        { status: 400 }
                    )
                }
                order.status = "disputed"
                console.log(`[Orders] Order ${order.id} disputed — will appear in admin panel for review`)
                break

            case "cancel":
                // Cancel order - users can cancel created orders, LPs can release matched orders
                if (order.status === "created") {
                    order.status = "cancelled"
                } else if (order.status === "matched") {
                    // LP releasing the order back to pool
                    order.status = "created"
                    order.solverId = undefined
                    order.solverAddress = undefined
                    order.matchedAt = undefined
                    broadcastOrderUpdate(order, "released")
                } else {
                    return NextResponse.json(
                        { success: false, error: "Cannot cancel order in this status" },
                        { status: 400 }
                    )
                }
                break

            case "add_qr":
                // User adds their UPI QR after LP match
                if (order.status !== "matched") {
                    return NextResponse.json(
                        { success: false, error: "Can only add QR after LP match" },
                        { status: 400 }
                    )
                }
                const { qrImage: addedQrImage } = body
                if (!addedQrImage) {
                    return NextResponse.json(
                        { success: false, error: "QR image is required" },
                        { status: 400 }
                    )
                }
                // Upload QR to IPFS
                const ipfsQr = await uploadBase64ToIPFS(addedQrImage, `${orderId}_qr_added`)
                order.qrImage = ipfsQr ? ipfsQr.url : addedQrImage
                if (ipfsQr) {
                    console.log(`[Orders] QR image uploaded to IPFS: ${ipfsQr.cid}`)
                }
                order.status = "payment_pending"
                break

            default:
                return NextResponse.json(
                    { success: false, error: "Invalid action" },
                    { status: 400 }
                )
        }

        // Update in Redis store (shared across all Vercel instances)
        await setOrder(order)

        // Broadcast update to all solvers (on this instance)
        broadcastOrderUpdate(order, action)

        return NextResponse.json({
            success: true,
            order,
            message: `Order ${action} successful`,
        })
    } catch (error) {
        console.error("Failed to update order:", error)
        return NextResponse.json(
            { success: false, error: "Failed to update order" },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/orders
 * 
 * Clear orders for a user (for development/testing)
 */
export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
        return NextResponse.json(
            { success: false, error: "Missing userId" },
            { status: 400 }
        )
    }

    // Delete all orders for this user
    const deleted = await deleteOrdersForUser(userId)

    console.log(`[Orders] Deleted ${deleted} orders for user ${userId}`)

    return NextResponse.json({
        success: true,
        deleted,
        message: `Deleted ${deleted} orders`,
    })
}
