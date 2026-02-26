"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronLeft, Clock, Check, AlertTriangle, X, Loader2, RefreshCw, Terminal, Shield, Trash2 } from "lucide-react"
import { BottomNav } from "@/components/app/bottom-nav"
import { useWallet } from "@/hooks/useWallet"
import { Order } from "@/app/api/orders/sse/route"
import { formatCurrency } from "@/lib/currency-converter"
import { TrustBadge } from "@/components/app/trust-score-card"

/**
 * User Orders Page
 * 
 * Shows all orders created by the user (transaction logs)
 * Uses localStorage as backup since server orders are in-memory
 */

// Helper to get orders from localStorage
const getLocalOrders = (address: string): Order[] => {
    if (typeof window === 'undefined') return []
    try {
        const stored = localStorage.getItem(`uwu_orders_${address.toLowerCase()}`)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

// Helper to save order to localStorage
export const saveOrderToLocal = (address: string, order: Order) => {
    if (typeof window === 'undefined') return
    try {
        const orders = getLocalOrders(address)
        // Check if order already exists and update it, or add new
        const existing = orders.findIndex(o => o.id === order.id)
        if (existing >= 0) {
            orders[existing] = order
        } else {
            orders.unshift(order)
        }
        // Keep only last 50 orders
        const trimmed = orders.slice(0, 50)
        localStorage.setItem(`uwu_orders_${address.toLowerCase()}`, JSON.stringify(trimmed))
    } catch (e) {
        console.warn('[Orders] Failed to save to localStorage:', e)
    }
}

export default function OrdersPage() {
    const { isConnected, address } = useWallet()
    const [orders, setOrders] = useState<Order[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [showDispute, setShowDispute] = useState(false)
    const [disputeReason, setDisputeReason] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Clear all logs
    const clearLogs = async () => {
        if (!address) return
        if (!confirm('Clear all order logs? This cannot be undone.')) return
        
        // Clear localStorage
        localStorage.removeItem(`uwu_orders_${address.toLowerCase()}`)
        
        // Clear from API
        try {
            await fetch(`/api/orders?userId=${address}`, { method: 'DELETE' })
        } catch (e) {
            console.warn('Failed to clear server logs:', e)
        }
        
        setOrders([])
    }

    // Fetch user's orders (API + localStorage fallback)
    const fetchOrders = async () => {
        if (!address) return

        try {
            // Get from API
            const res = await fetch(`/api/orders?userId=${address}`)
            const data = await res.json()
            const apiOrders: Order[] = data.success ? (data.orders || []) : []
            
            // Get from localStorage as backup
            const localOrders = getLocalOrders(address)
            
            // Merge: API orders take precedence, but include local orders not in API
            const apiOrderIds = new Set(apiOrders.map(o => o.id))
            const mergedOrders = [
                ...apiOrders,
                ...localOrders.filter(o => !apiOrderIds.has(o.id))
            ]
            
            // Sort by createdAt descending
            mergedOrders.sort((a, b) => b.createdAt - a.createdAt)
            
            setOrders(mergedOrders)
            
            // Update localStorage with merged data
            if (mergedOrders.length > 0) {
                localStorage.setItem(`uwu_orders_${address.toLowerCase()}`, JSON.stringify(mergedOrders.slice(0, 50)))
            }
        } catch (error) {
            console.error("Failed to fetch orders from API:", error)
            // Fall back to localStorage only
            const localOrders = getLocalOrders(address)
            setOrders(localOrders)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchOrders()
        const interval = setInterval(fetchOrders, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [address])

    const handleDispute = async () => {
        if (!selectedOrder || !disputeReason) return

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: selectedOrder.id,
                    action: "dispute",
                }),
            })

            const data = await res.json()
            if (data.success) {
                setShowDispute(false)
                setSelectedOrder(null)
                setDisputeReason("")
                fetchOrders()
            }
        } catch (error) {
            console.error("Failed to dispute:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusConfig = (status: Order['status']) => {
        switch (status) {
            case 'created':
                return { color: 'text-brand border-brand', label: 'WAITING_LP', icon: Clock }
            case 'matched':
                return { color: 'text-warning border-warning', label: 'LP_CONNECTED', icon: Clock }
            case 'payment_pending':
                return { color: 'text-warning border-warning', label: 'AWAITING_PAYMENT', icon: Clock }
            case 'payment_sent':
                return { color: 'text-warning border-warning', label: 'VERIFYING', icon: Loader2 }
            case 'completed':
            case 'settled':
                return { color: 'text-success border-success', label: 'COMPLETED', icon: Check }
            case 'disputed':
                return { color: 'text-error border-error', label: 'DISPUTE_ACTIVE', icon: AlertTriangle }
            case 'cancelled':
                return { color: 'text-error border-error', label: 'CANCELLED', icon: X }
            default:
                return { color: 'text-text-secondary border-text-secondary', label: status.toUpperCase(), icon: Clock }
        }
    }

    const getDisputeCountdown = (disputePeriodEndsAt?: number) => {
        if (!disputePeriodEndsAt) return null
        const remaining = disputePeriodEndsAt - Date.now()
        if (remaining <= 0) return "SETTLEMENT_READY"

        const hours = Math.floor(remaining / (1000 * 60 * 60))
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}H ${minutes}M LEFT`
    }

    if (!isConnected) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
                <div className="bg-black border border-border p-8 text-center mt-12 mb-6">
                    <Terminal className="w-12 h-12 text-brand mx-auto mb-4 opacity-50" />
                    <h2 className="text-lg font-bold mb-2 text-white uppercase tracking-widest">ACCESS_RESTRICTED</h2>
                    <p className="text-xs text-text-secondary font-mono mb-6">
                        {">"} AUTHENTICATION_REQUIRED<br />
                        {">"} CONNECT_WALLET_TO_VIEW_LOGS
                    </p>
                    <Link href="/dashboard" className="inline-block px-6 py-3 border border-brand text-brand hover:bg-brand hover:text-black font-bold uppercase text-xs transition-colors">
                        [ LOGIN_TERMINAL ]
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 border-b border-border pb-4 border-dashed">
                <Link href="/dashboard" className="flex items-center gap-2 text-text-secondary hover:text-brand transition-colors uppercase text-xs tracking-wider">
                    <ChevronLeft className="w-4 h-4" />
                    [BACK]
                </Link>
                <div className="text-center">
                    <h1 className="text-lg font-bold uppercase text-brand">Transactions</h1>
                    <p className="text-[10px] text-text-secondary uppercase">Order History</p>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={clearLogs} className="p-2 text-text-secondary hover:text-error transition-colors" title="Clear logs">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={fetchOrders} className="p-2 text-text-secondary hover:text-brand transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-brand mb-2" />
                        <p className="text-[10px] text-brand uppercase animate-pulse">FETCHING_DATA...</p>
                    </div>
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-black border border-border border-dashed p-8 text-center opacity-80">
                    <Terminal className="w-12 h-12 text-text-secondary mx-auto mb-4 opacity-50" />
                    <h3 className="font-bold mb-2 uppercase text-white tracking-widest">NO_LOGS_FOUND</h3>
                    <p className="text-xs text-text-secondary font-mono mb-6">
                        {">"} TRANSACTION_BUFFER_EMPTY<br />
                        {">"} INITIATE_FIRST_ORDER_TO_POPULATE
                    </p>
                    <Link href="/scan" className="inline-block px-6 py-3 bg-brand text-black font-bold uppercase text-xs hover:bg-brand-hover">
                        [ INITIATE_ORDER ]
                    </Link>
                </div>
            ) : (
                <div className="space-y-px bg-border border border-border">
                    {orders.map(order => {
                        const config = getStatusConfig(order.status)
                        const StatusIcon = config.icon

                        return (
                            <button
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="w-full bg-black hover:bg-surface p-4 text-left group relative overflow-hidden transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold font-mono text-white text-lg tracking-tight">
                                            {formatCurrency(order.amountFiat, order.fiatCurrency)}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-text-secondary uppercase font-mono bg-surface px-1 border border-border">
                                                ID: {order.id.slice(0, 8)}
                                            </span>
                                            <span className="text-[10px] text-text-secondary font-mono">
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`px-2 py-1 border text-[10px] font-bold uppercase flex items-center gap-1 ${config.color}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {config.label}
                                    </div>
                                </div>

                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-brand font-mono">
                                        {">"} {order.amountUsdc.toFixed(2)} USDC
                                    </span>
                                </div>

                                {/* Dispute countdown - for completed orders in 24hr window */}
                                {(order.status === 'payment_sent' || order.status === 'completed') && order.disputePeriodEndsAt && order.disputePeriodEndsAt > Date.now() && (
                                    <div className="mt-2 text-[10px] text-warning uppercase font-mono flex items-center gap-1 animate-pulse">
                                        <Clock className="w-3 h-3" />
                                        DISPUTE_WINDOW: {getDisputeCountdown(order.disputePeriodEndsAt)}
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && !showDispute && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-mono">
                    <div className="bg-black border border-brand w-full max-w-sm max-h-[80vh] overflow-y-auto relative shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand via-white to-brand opacity-50"></div>

                        <div className="p-4 border-b border-border border-dashed flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase text-brand">LOG_DETAILS_{selectedOrder.id.slice(0, 4)}</h3>
                            <button onClick={() => setSelectedOrder(null)} className="p-1 hover:text-white text-text-secondary">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 pb-6">
                            {/* Status Banner */}
                            <div className={`p-3 mb-6 border ${getStatusConfig(selectedOrder.status).color} bg-opacity-10 text-center`}>
                                <p className="text-xs font-bold uppercase tracking-widest">{getStatusConfig(selectedOrder.status).label}</p>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-2 border border-border mb-6">
                                <div className="p-3 border-b border-r border-border">
                                    <p className="text-[10px] text-text-secondary uppercase mb-1">REQ_FIAT</p>
                                    <p className="font-bold text-white">{formatCurrency(selectedOrder.amountFiat, selectedOrder.fiatCurrency)}</p>
                                </div>
                                <div className="p-3 border-b border-border">
                                    <p className="text-[10px] text-text-secondary uppercase mb-1">EST_USDC</p>
                                    <p className="font-bold text-brand">{selectedOrder.amountUsdc.toFixed(2)}</p>
                                </div>
                                <div className="p-3 border-r border-border col-span-2">
                                    <p className="text-[10px] text-text-secondary uppercase mb-1">TIMESTAMP</p>
                                    <p className="text-xs text-white">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                                </div>
                            </div>

                            {selectedOrder.solverId && (
                                <div className="mb-6 p-3 border border-border bg-surface/20">
                                    <p className="text-[10px] text-text-secondary uppercase mb-2">CONNECTED_PEER</p>
                                    <p className="font-mono text-xs text-white break-all mb-3">{selectedOrder.solverId}</p>
                                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                        <Shield className="w-3 h-3 text-brand" />
                                        <span className="text-[10px] text-text-secondary uppercase">TRUST_STATUS:</span>
                                        <TrustBadge address={selectedOrder.solverId} />
                                    </div>
                                </div>
                            )}

                            {/* QR Preview */}
                            {selectedOrder.qrImage && (
                                <div className="mb-6 border border-border p-2 bg-white">
                                    <p className="text-[10px] text-gray-500 uppercase mb-2 text-center w-full border-b border-gray-200 pb-1">UPLOADED_DATA</p>
                                    <img
                                        src={selectedOrder.qrImage}
                                        alt="Your QR"
                                        className="max-h-32 mx-auto object-contain"
                                    />
                                </div>
                            )}

                            {/* LP Payment Proof */}
                            {selectedOrder.lpPaymentProof && (
                                <div className="mb-6 border border-border p-2 bg-black">
                                    <p className="text-[10px] text-text-secondary uppercase mb-2 text-center w-full border-b border-border border-dashed pb-1">PROOF_OF_SETTLEMENT</p>
                                    <img
                                        src={selectedOrder.lpPaymentProof}
                                        alt="Payment proof"
                                        className="w-full border border-border opacity-90"
                                    />
                                </div>
                            )}

                            {/* Dispute Period Countdown - for completed orders within 24hr window */}
                            {(selectedOrder.status === 'payment_sent' || selectedOrder.status === 'completed') && 
                             selectedOrder.disputePeriodEndsAt && selectedOrder.disputePeriodEndsAt > Date.now() && (
                                <div className="bg-warning/10 border border-warning/30 p-4 mb-6 text-center">
                                    <p className="text-xs font-bold text-warning uppercase mb-1 animate-pulse">DISPUTE_WINDOW_ACTIVE</p>
                                    <p className="text-[10px] text-text-secondary uppercase">
                                        TIME_REMAINING: {getDisputeCountdown(selectedOrder.disputePeriodEndsAt)}
                                    </p>
                                    <p className="text-[10px] text-text-secondary mt-2 border-t border-warning/20 pt-2">
                                        {">"} LP_PAID_INSTANTLY. IF_ISSUE_RAISE_DISPUTE<br />
                                        {">"} 4HR_ADDRESSAL_SLA | 24HR_DISPUTE_WINDOW
                                    </p>
                                </div>
                            )}

                            {/* Actions - Allow dispute for completed orders within 24hr window */}
                            {(selectedOrder.status === 'payment_sent' || 
                              (selectedOrder.status === 'completed' && selectedOrder.disputePeriodEndsAt && selectedOrder.disputePeriodEndsAt > Date.now())) && (
                                <button
                                    onClick={() => setShowDispute(true)}
                                    className="w-full py-3 border border-error text-error hover:bg-error hover:text-white font-bold uppercase text-xs mb-3 transition-colors"
                                >
                                    [ RAISE_DISPUTE_FLAG ]
                                </button>
                            )}

                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="w-full py-3 bg-surface border border-border text-text-secondary font-bold uppercase text-xs hover:text-white hover:border-white transition-colors"
                            >
                                CLOSE_WINDOW
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dispute Modal */}
            {showDispute && selectedOrder && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[60] p-4 font-mono">
                    <div className="bg-black border-2 border-error w-full max-w-sm p-6 relative shadow-[0_0_50px_rgba(239,68,68,0.2)]">

                        <div className="flex items-center justify-between mb-6 border-b border-error/50 pb-4">
                            <h3 className="text-lg font-bold text-error uppercase tracking-widest">DISPUTE_PROTOCOL</h3>
                            <button onClick={() => setShowDispute(false)} className="p-1 text-error hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-error/10 border border-error/30 p-4 mb-6 text-xs text-error">
                            <p className="font-bold uppercase mb-2">WARNING: SEVERE_ACTION</p>
                            <p className="opacity-80">
                                {">"} FALSE_FLAGS_RESULT_IN_BAN<br />
                                {">"} ONLY_PROCEED_IF_FUNDS_MISSING
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="text-[10px] text-text-secondary uppercase block mb-2">
                                REASON_FOR_FLAGGING
                            </label>
                            <textarea
                                value={disputeReason}
                                onChange={(e) => setDisputeReason(e.target.value)}
                                placeholder="> ENTER_DETAILS_HERE..."
                                className="w-full bg-black border border-border p-3 text-xs text-white min-h-24 focus:border-error outline-none font-mono placeholder:text-gray-800"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDispute(false)}
                                className="py-3 border border-border text-text-secondary font-bold uppercase text-xs hover:bg-surface"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleDispute}
                                disabled={!disputeReason || isSubmitting}
                                className="py-3 bg-error text-white font-bold uppercase text-xs hover:bg-red-600 disabled:opacity-50"
                            >
                                {isSubmitting ? "TRANSMITTING..." : "CONFIRM_DISPUTE"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNav />
        </div>
    )
}
