"use client"

import { useState, useEffect, useCallback, useRef } from "react"

/**
 * Order Type matching the API
 */
export interface Order {
    id: string
    type: "buy" | "sell"
    status: "created" | "matched" | "payment_pending" | "payment_sent" | "completed" | "disputed" | "cancelled" | "expired" | "settled" | "verifying"
    userId: string
    userAddress: string
    amountUsdc: number
    amountFiat: number
    fiatCurrency: string
    paymentMethod: string
    paymentDetails: string
    qrImage?: string           // User's destination QR (base64)
    lpPaymentProof?: string    // LP's payment screenshot (base64)
    createdAt: number
    expiresAt: number
    matchedAt?: number
    solverId?: string
    solverAddress?: string
    paymentSentAt?: number     // When LP marked payment sent
    disputePeriodEndsAt?: number // 24hrs after completion - user can dispute
    stakeLockExpiresAt?: number  // 24hrs after completion - LP stake unlocks
    completedAt?: number
    settledAt?: number         // When USDC released to LP (now immediate)
}

/**
 * SSE Message Types
 */
interface SSEMessage {
    type: "connected" | "active_orders" | "new_order" | "order_update" | "ping"
    message?: string
    orders?: Order[]
    order?: Order
    updateType?: string
    timestamp: number
}

/**
 * Hook for subscribing to real-time order updates via SSE
 * 
 * Used by solvers to receive new orders and order updates in real-time
 */
export function useOrderSSE(solverId?: string) {
    const [orders, setOrders] = useState<Order[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [lastUpdate, setLastUpdate] = useState<number | null>(null)
    const [error, setError] = useState<Error | null>(null)

    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    /**
     * Connect to SSE endpoint
     */
    const connect = useCallback(() => {
        if (!solverId) return

        // Close existing connection
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
        }

        try {
            const eventSource = new EventSource(`/api/orders/sse?solverId=${solverId}`)
            eventSourceRef.current = eventSource

            eventSource.onopen = () => {
                setIsConnected(true)
                setError(null)
            }

            eventSource.onmessage = (event) => {
                try {
                    const data: SSEMessage = JSON.parse(event.data)
                    setLastUpdate(data.timestamp)

                    switch (data.type) {
                        case "connected":
                            console.log("SSE connected:", data.message)
                            break

                        case "active_orders":
                            if (data.orders) {
                                setOrders(data.orders)
                            }
                            break

                        case "new_order":
                            if (data.order) {
                                setOrders(prev => [data.order!, ...prev])
                            }
                            break

                        case "order_update":
                            if (data.order) {
                                setOrders(prev =>
                                    prev.map(o => o.id === data.order!.id ? data.order! : o)
                                )
                            }
                            break

                        case "ping":
                            // Keep-alive, no action needed
                            break
                    }
                } catch (e) {
                    console.error("Failed to parse SSE message:", e)
                }
            }

            eventSource.onerror = () => {
                setIsConnected(false)
                setError(new Error("Connection lost"))

                // Attempt reconnect after 5 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    connect()
                }, 5000)
            }
        } catch (e) {
            console.error("Failed to create EventSource:", e)
            setError(e as Error)
        }
    }, [solverId])

    /**
     * Disconnect from SSE
     */
    const disconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
            reconnectTimeoutRef.current = null
        }
        setIsConnected(false)
    }, [])

    /**
     * Match an order (solver accepts)
     */
    const matchOrder = useCallback(async (orderId: string, solverAddress: string) => {
        if (!solverId) return false

        try {
            const response = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    action: "match",
                    solverId,
                    solverAddress,
                }),
            })

            const data = await response.json()
            return data.success
        } catch (e) {
            console.error("Failed to match order:", e)
            return false
        }
    }, [solverId])

    /**
     * Mark payment as sent
     */
    const markPaymentSent = useCallback(async (orderId: string) => {
        try {
            const response = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    action: "payment_sent",
                }),
            })

            const data = await response.json()
            return data.success
        } catch (e) {
            console.error("Failed to mark payment sent:", e)
            return false
        }
    }, [])

    // Auto-connect when solverId is provided
    useEffect(() => {
        if (solverId) {
            connect()
        }

        return () => {
            disconnect()
        }
    }, [solverId, connect, disconnect])

    // Filter active orders (not matched, completed, cancelled, or expired)
    const activeOrders = orders.filter(o => o.status === "created")
    const myMatchedOrders = orders.filter(o => o.solverId === solverId && ["matched", "payment_sent", "payment_pending"].includes(o.status))

    return {
        // All orders
        orders,

        // Filtered orders
        activeOrders,
        myMatchedOrders,

        // Connection state
        isConnected,
        lastUpdate,
        error,

        // Actions
        connect,
        disconnect,
        matchOrder,
        markPaymentSent,
    }
}

/**
 * Hook for users to manage their orders
 */
export function useUserOrders(userId?: string) {
    const [orders, setOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    /**
     * Fetch user's orders
     */
    const fetchOrders = useCallback(async () => {
        if (!userId) return

        setIsLoading(true)
        try {
            const response = await fetch(`/api/orders?userId=${userId}`)
            const data = await response.json()

            if (data.success) {
                setOrders(data.orders)
            }
        } catch (e) {
            setError(e as Error)
        } finally {
            setIsLoading(false)
        }
    }, [userId])

    /**
     * Create a new sell order
     */
    const createSellOrder = useCallback(async (orderData: {
        amountUsdc: number
        amountFiat: number
        fiatCurrency: string
        paymentMethod: string
        paymentDetails?: string
        userAddress: string
    }) => {
        if (!userId) return null

        try {
            const response = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...orderData,
                    userId,
                    type: "sell",
                }),
            })

            const data = await response.json()

            if (data.success) {
                setOrders(prev => [data.order, ...prev])
                return data.order
            }
            return null
        } catch (e) {
            console.error("Failed to create order:", e)
            return null
        }
    }, [userId])

    /**
     * Confirm payment received (release USDC to solver)
     */
    const confirmPaymentReceived = useCallback(async (orderId: string) => {
        try {
            const response = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    action: "complete",
                }),
            })

            const data = await response.json()

            if (data.success) {
                setOrders(prev =>
                    prev.map(o => o.id === orderId ? data.order : o)
                )
            }
            return data.success
        } catch (e) {
            console.error("Failed to confirm payment:", e)
            return false
        }
    }, [])

    /**
     * Raise a dispute
     */
    const raiseDispute = useCallback(async (orderId: string, reason: string) => {
        try {
            const response = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    action: "dispute",
                }),
            })

            const data = await response.json()

            if (data.success) {
                setOrders(prev =>
                    prev.map(o => o.id === orderId ? data.order : o)
                )
            }
            return data.success
        } catch (e) {
            console.error("Failed to raise dispute:", e)
            return false
        }
    }, [])

    /**
     * Cancel an order
     */
    const cancelOrder = useCallback(async (orderId: string) => {
        try {
            const response = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    action: "cancel",
                }),
            })

            const data = await response.json()

            if (data.success) {
                setOrders(prev =>
                    prev.map(o => o.id === orderId ? data.order : o)
                )
            }
            return data.success
        } catch (e) {
            console.error("Failed to cancel order:", e)
            return false
        }
    }, [])

    // Fetch orders on mount and poll for updates
    useEffect(() => {
        fetchOrders()

        // Poll every 3s to pick up status changes from solvers
        const interval = setInterval(fetchOrders, 3000)
        return () => clearInterval(interval)
    }, [fetchOrders])

    return {
        orders,
        isLoading,
        error,
        refetch: fetchOrders,
        createSellOrder,
        confirmPaymentReceived,
        raiseDispute,
        cancelOrder,
    }
}
