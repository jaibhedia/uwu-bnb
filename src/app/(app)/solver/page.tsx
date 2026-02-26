"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, Power, Check, Upload, Clock, AlertTriangle, Loader2, X, DollarSign, History, Gift, Home, ShieldAlert, ImageIcon, Calendar, ExternalLink, ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/app/bottom-nav"
import { QRScanner } from "@/components/app/qr-scanner"
import { WalletConnect } from "@/components/app/wallet-connect"
import { useWallet } from "@/hooks/useWallet"
import { useStaking } from "@/hooks/useStaking"
import { formatCurrency } from "@/lib/currency-converter"
import { Order } from "@/app/api/orders/sse/route"
import { useSafeNavigation } from "@/hooks/useSafeNavigation"

/**
 * LP (Solver) Dashboard
 * 
 * Flow:
 * 1. LP goes "active" to receive orders
 * 2. See live order feed with user QR codes
 * 3. Accept order -> View user's QR
 * 4. Pay the QR -> Upload payment screenshot
 * 5. IMMEDIATE SETTLEMENT: Receive USDC + reward instantly
 *    (Stake locked for 24hr in case of dispute, 4hr SLA for resolution)
 */

export default function SolverPage() {
    const router = useRouter()
    const { goBack, goHome, isLP } = useSafeNavigation()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { isConnected, address, balance, displayName, isLoading: walletLoading } = useWallet()
    const { stakeProfile, fetchStakeProfile } = useStaking()
    const [mounted, setMounted] = useState(false)
    const [isActive, setIsActiveState] = useState(false)
    const [orders, setOrders] = useState<Order[]>([])
    const [acceptedOrder, setAcceptedOrder] = useState<Order | null>(null)
    const [paymentProof, setPaymentProof] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    // Added "waiting_qr" step for amount-first flow
    const [step, setStep] = useState<"browse" | "waiting_qr" | "pay" | "proof" | "pending" | "settled">("browse")
    const [countdown, setCountdown] = useState<string>("--:--:--")
    const [myOrders, setMyOrders] = useState<Order[]>([])
    const [showHistory, setShowHistory] = useState(false)
    const [upiId, setUpiId] = useState("") // LP can enter UPI ID manually
    const [showScanner, setShowScanner] = useState(false) // For live camera QR scanning
    const [scannedQrData, setScannedQrData] = useState<string | null>(null) // Scanned UPI data
    const [lockedStake, setLockedStake] = useState(0) // USDC locked in 24hr window
    const [expandedDispute, setExpandedDispute] = useState<string | null>(null) // Expanded dispute order ID

    // Initialize active state from sessionStorage on mount
    useEffect(() => {
        setMounted(true)
        const savedActive = sessionStorage.getItem('lp_active_status')
        if (savedActive === 'true') {
            setIsActiveState(true)
        }
    }, [])

    // Fetch stake profile and locked stake on mount
    useEffect(() => {
        if (address) {
            fetchStakeProfile()
        }
    }, [address, fetchStakeProfile])

    // Calculate locked stake from recent orders (24hr window)
    useEffect(() => {
        if (!address || myOrders.length === 0) {
            setLockedStake(0)
            return
        }
        
        const now = Date.now()
        let locked = 0
        
        myOrders.forEach(order => {
            // Orders still in progress lock their amount
            if (["matched", "payment_pending", "verifying"].includes(order.status)) {
                locked += order.amountUsdc
            }
            // Completed orders in 24hr window lock stake
            if (order.status === "completed" && order.stakeLockExpiresAt && order.stakeLockExpiresAt > now) {
                locked += order.amountUsdc
            }
        })
        
        setLockedStake(locked)
    }, [address, myOrders])

    // Available stake = total stake - locked
    const totalStake = stakeProfile?.baseStake || 0
    const availableStake = Math.max(0, totalStake - lockedStake)

    // Wrapper to persist active state to sessionStorage
    const setIsActive = (value: boolean) => {
        setIsActiveState(value)
        sessionStorage.setItem('lp_active_status', value.toString())
    }

    // Fetch active orders when LP is active
    // Also do an immediate fetch when wallet connects, even before toggling active
    useEffect(() => {
        if (!isActive || !address) return

        let isMounted = true

        const fetchOrders = async () => {
            if (!isMounted) return
            try {
                const res = await fetch("/api/orders?status=created")
                const data = await res.json()
                if (data.success && isMounted) {
                    setOrders(data.orders || [])
                }
            } catch (error) {
                console.error("Failed to fetch orders:", error)
            }
        }

        // Fetch immediately on activation / wallet connect
        fetchOrders()
        // Poll rapidly at first (1s), then slow down to 3s
        let pollCount = 0
        const interval = setInterval(() => {
            fetchOrders()
            pollCount++
        }, pollCount < 6 ? 1000 : 3000) // First 6 polls at 1s, then 3s

        // Also subscribe to SSE for real-time order notifications
        let eventSource: EventSource | null = null
        try {
            eventSource = new EventSource(`/api/orders/sse?solverId=${address}`)
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.type === "new_order" && data.order) {
                        setOrders(prev => {
                            // Avoid duplicates
                            if (prev.some(o => o.id === data.order.id)) return prev
                            return [data.order, ...prev]
                        })
                    } else if (data.type === "active_orders" && data.orders) {
                        setOrders(data.orders)
                    } else if (data.type === "order_update" && data.order) {
                        if (data.order.status !== "created") {
                            // Remove from available orders if no longer created
                            setOrders(prev => prev.filter(o => o.id !== data.order.id))
                        } else {
                            setOrders(prev => prev.map(o => o.id === data.order.id ? data.order : o))
                        }
                    }
                } catch (e) {
                    // Ignore parse errors from ping messages
                }
            }
            eventSource.onerror = () => {
                // SSE will auto-reconnect, polling is the fallback
                console.log("[Solver] SSE connection lost, relying on polling")
            }
        } catch (e) {
            console.log("[Solver] SSE not available, using polling only")
        }

        return () => {
            isMounted = false
            clearInterval(interval)
            eventSource?.close()
        }
    }, [isActive, address])

    // Fetch LP's pending orders and detect status changes
    useEffect(() => {
        if (!address) return

        let isMounted = true

        const fetchMyOrders = async () => {
            if (!isMounted) return

            try {
                const res = await fetch(`/api/orders?solverId=${address}`)
                const data = await res.json()

                if (!isMounted) return

                if (data.success && data.orders?.length > 0) {
                    setMyOrders(data.orders)
                    const pending = data.orders.find((o: Order) =>
                        o.status === "matched" || o.status === "payment_pending" || o.status === "verifying"
                    )
                    const settled = data.orders.find((o: Order) => 
                        o.status === "settled" || o.status === "completed"
                    )

                    if (pending && isMounted) {
                        setAcceptedOrder(pending)

                        // Only auto-update step if we are NOT in the middle of uploading proof
                        if (step !== "proof") {
                            // Determine step based on order status and QR presence
                            if (pending.status === "matched" && !pending.qrImage) {
                                setStep("waiting_qr")
                            } else if (pending.status === "payment_pending" || (pending.status === "matched" && pending.qrImage)) {
                                setStep("pay")
                            } else if (pending.status === "verifying") {
                                // DAO validators are reviewing — show pending step
                                setStep("pending")
                            }
                        }
                    } else if (settled && isMounted && step !== "settled" && step !== "browse") {
                        // Order completed - show success
                        // But don't override if user is back at browse (clicked continue)
                        setAcceptedOrder(settled)
                        setStep("settled")
                    }
                }
            } catch (error) {
                console.error("Failed to fetch my orders:", error)
            }
        }

        fetchMyOrders()
        const interval = setInterval(fetchMyOrders, 3000) // Poll every 3s for order state changes

        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [address, step])

    // Live countdown timer
    useEffect(() => {
        if (step !== "pending" || !acceptedOrder?.disputePeriodEndsAt) return

        const updateCountdown = () => {
            const remaining = (acceptedOrder.disputePeriodEndsAt || 0) - Date.now()
            if (remaining <= 0) {
                setCountdown("Ready to claim!")
                return
            }

            const hours = Math.floor(remaining / (1000 * 60 * 60))
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
            setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
        }

        updateCountdown()
        const interval = setInterval(updateCountdown, 1000)
        return () => clearInterval(interval)
    }, [step, acceptedOrder?.disputePeriodEndsAt])

    const handleAcceptOrder = async (order: Order) => {
        if (!address) return

        // Check if LP has enough available stake
        if (order.amountUsdc > availableStake) {
            alert(`Insufficient available stake!\n\nOrder: $${order.amountUsdc} USDC\nAvailable: $${availableStake.toFixed(2)} USDC\nLocked: $${lockedStake.toFixed(2)} USDC (in 24hr dispute window)\n\nWait for pending orders to clear or stake more USDC.`)
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: order.id,
                    action: "match",
                    solverId: address,
                    solverAddress: address,
                }),
            })

            const data = await res.json()
            if (data.success) {
                setAcceptedOrder(data.order)
                // Amount-first flow: if no QR yet, go to waiting_qr step
                if (data.order.qrImage) {
                    setStep("pay")
                } else {
                    setStep("waiting_qr")
                }
                setOrders(prev => prev.filter(o => o.id !== order.id))
            }
        } catch (error) {
            console.error("Failed to accept order:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            setPaymentProof(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    const handleSubmitProof = async () => {
        if (!acceptedOrder || !paymentProof) return

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: acceptedOrder.id,
                    action: "payment_sent",
                    lpPaymentProof: paymentProof,
                }),
            })

            const data = await res.json()
            if (data.success) {
                setAcceptedOrder(data.order)
                // DAO validation — go to pending (verifying) step
                setStep("pending")
            }
        } catch (error) {
            console.error("Failed to submit proof:", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!mounted) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-surface/50 border border-border rounded w-32 mb-6"></div>
                    <div className="h-40 bg-surface/20 border border-border border-dashed rounded"></div>
                </div>
            </div>
        )
    }

    // Show loading while wallet is initializing
    if (walletLoading) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-4" />
                    <p className="text-xs text-text-secondary uppercase">INITIALIZING_WALLET...</p>
                </div>
            </div>
        )
    }

    if (!isConnected) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
                <div className="flex items-center justify-between mb-8 border-b border-border pb-4 border-dashed">
                    <button onClick={goBack} className="flex items-center gap-2 text-text-secondary hover:text-brand uppercase text-xs tracking-wider">
                        <ChevronLeft className="w-4 h-4" />
                        [BACK]
                    </button>
                </div>
                <div className="bg-black border-2 border-brand/50 p-8 text-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-30 text-[10px] uppercase text-brand">ACCESS_REQUIRED</div>

                    <DollarSign className="w-16 h-16 text-brand mx-auto mb-6 opacity-80" />
                    <h2 className="text-xl font-bold mb-2 uppercase text-white tracking-widest">LP_TERMINAL</h2>
                    <p className="text-sm text-text-secondary font-mono mb-6 max-w-xs mx-auto">
                        {">"} AUTHENTICATION_REQUIRED<br />
                        {">"} CONNECT_WALLET_TO_ACCESS_LP_TOOLS
                    </p>
                    <WalletConnect />
                </div>
                <BottomNav />
            </div>
        )
    }

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-8 border-b border-border pb-4 border-dashed">
                <button onClick={goBack} className="flex items-center gap-2 text-text-secondary hover:text-brand transition-colors uppercase text-xs tracking-wider">
                    <ChevronLeft className="w-4 h-4" />
                    [BACK]
                </button>
                <div className="text-center">
                    <h1 className="text-lg font-bold uppercase text-warning">LP_TERMINAL</h1>
                    <p className="text-[10px] text-text-secondary uppercase">FULFILL ORDERS • EARN YIELD</p>
                </div>
                <button onClick={goHome} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-brand">
                    <Home className="w-4 h-4" />
                </button>
            </div>

            {/* Balance Info */}
            <div className="grid grid-cols-2 gap-px bg-border border border-border mb-6">
                <div className="bg-black p-3">
                    <p className="text-[10px] text-text-secondary uppercase mb-1">WALLET_BALANCE</p>
                    <p className="text-lg font-bold font-mono text-success">${balance.toFixed(2)}</p>
                </div>
                <div className="bg-black p-3">
                    <p className="text-[10px] text-text-secondary uppercase mb-1">AVAILABLE</p>
                    <p className="text-lg font-bold font-mono text-brand">${availableStake.toFixed(2)}</p>
                </div>
            </div>

            {/* Step: Browse Orders */}
            {step === "browse" && (
                <>
                    {/* Active Toggle (System Status) */}
                    <div className={`p-4 mb-6 border ${isActive ? "border-success bg-success/5" : "border-border bg-card"}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider">
                                Status: {isActive ? <span className="text-success">ACTIVE</span> : <span className="text-text-secondary">OFFLINE</span>}
                            </span>
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`w-10 h-5 rounded-none border relative transition-colors ${isActive ? "border-success bg-success/20" : "border-border bg-surface"}`}
                            >
                                <div className={`absolute top-0.5 bottom-0.5 w-4 bg-current transition-all ${isActive ? "right-0.5 bg-success" : "left-0.5 bg-text-secondary"}`} />
                            </button>
                        </div>
                        <p className="text-[10px] text-text-secondary font-mono">
                            {isActive ? "Receiving live orders from users..." : "Go active to start receiving orders"}
                        </p>
                    </div>

                    {isActive && (
                        <>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className={`text-xs font-bold uppercase ${!showHistory ? 'text-brand' : 'text-text-secondary'}`}
                                    >
                                        Incoming ({orders.length})
                                    </button>
                                    <button
                                        onClick={() => setShowHistory(true)}
                                        className={`text-xs font-bold uppercase ${showHistory ? 'text-brand' : 'text-text-secondary'}`}
                                    >
                                        History ({myOrders.filter(o => ['completed', 'settled', 'disputed', 'mediation'].includes(o.status)).length})
                                    </button>
                                </div>
                                {!showHistory && <span className="text-[10px] text-brand animate-pulse">● LIVE</span>}
                            </div>

                            {/* Incoming Orders */}
                            {!showHistory && (
                                <>
                                    {orders.length === 0 ? (
                                        <div className="border border-border border-dashed p-8 text-center bg-surface/20">
                                            <div className="inline-block p-3 rounded-full bg-surface mb-2">
                                                <Clock className="w-6 h-6 text-text-secondary animate-spin-slow" />
                                            </div>
                                            <p className="text-xs text-text-secondary font-mono">Waiting for orders...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {orders.map(order => (
                                                <div key={order.id} className="border border-border bg-card hover:border-brand transition-colors p-4 group relative overflow-hidden">
                                                    <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[10px] uppercase text-brand border border-brand px-1">NEW</span>
                                                    </div>

                                                    <div className="flex justify-between items-start mb-3 pr-8">
                                                        <div className="min-w-0">
                                                            <p className="text-lg font-bold font-mono text-white">{formatCurrency(order.amountFiat, order.fiatCurrency)}</p>
                                                            <p className="text-[10px] text-text-secondary uppercase">via {order.paymentMethod}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-brand font-mono text-sm font-bold">
                                                                +{order.amountUsdc?.toFixed(2)} USDC
                                                            </p>
                                                            <p className="text-[10px] text-text-secondary uppercase">You earn</p>
                                                        </div>
                                                    </div>

                                                    {/* QR Preview (Mini) */}
                                                    {order.qrImage && (
                                                        <div className="bg-white p-1 w-fit mb-3 border border-border">
                                                            <img src={order.qrImage} alt="QR" className="h-12 w-12 object-contain" />
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => handleAcceptOrder(order)}
                                                        disabled={isSubmitting || order.amountUsdc > availableStake}
                                                        className="w-full py-2 bg-brand/10 border border-brand/50 text-brand font-bold text-xs uppercase hover:bg-brand hover:text-black transition-all disabled:opacity-50"
                                                    >
                                                        {isSubmitting ? "Processing..." : order.amountUsdc > availableStake ? `Insufficient stake (need $${order.amountUsdc})` : "Accept Order"}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Order History */}
                            {showHistory && (
                                <div className="space-y-3">
                                    {myOrders.filter(o => ['completed', 'settled', 'disputed', 'mediation'].includes(o.status)).length === 0 ? (
                                        <div className="border border-border border-dashed p-8 text-center bg-surface/20">
                                            <p className="text-xs text-text-secondary font-mono">No completed orders yet</p>
                                        </div>
                                    ) : (
                                        myOrders
                                            .filter(o => ['completed', 'settled', 'disputed', 'mediation'].includes(o.status))
                                            .map(order => (
                                                <div key={order.id} className={`border bg-card ${
                                                    order.status === 'disputed' || order.status === 'mediation'
                                                        ? 'border-red-500/30'
                                                        : 'border-border'
                                                }`}>
                                                    {/* Clickable header */}
                                                    <div
                                                        className={`p-4 ${(order.status === 'disputed' || order.status === 'mediation') ? 'cursor-pointer hover:bg-surface/50' : ''}`}
                                                        onClick={() => {
                                                            if (order.status === 'disputed' || order.status === 'mediation') {
                                                                setExpandedDispute(expandedDispute === order.id ? null : order.id)
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                {(order.status === 'disputed' || order.status === 'mediation') && (
                                                                    <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0" />
                                                                )}
                                                                <div>
                                                                    <p className="text-sm font-bold font-mono text-white">{formatCurrency(order.amountFiat, order.fiatCurrency)}</p>
                                                                    <p className="text-[10px] text-text-secondary uppercase">
                                                                        {order.id.slice(0, 12)} | {new Date(order.completedAt || order.createdAt).toLocaleDateString()}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex items-center gap-2">
                                                                <div>
                                                                    <p className={`font-mono text-sm font-bold ${
                                                                        order.status === 'completed' || order.status === 'settled' ? 'text-success' : 'text-text-primary'
                                                                    }`}>
                                                                        +{order.amountUsdc?.toFixed(2)} USDC
                                                                    </p>
                                                                    <span className={`text-[10px] uppercase px-1 border ${
                                                                        order.status === 'completed' || order.status === 'settled' 
                                                                            ? 'text-success border-success' 
                                                                            : order.status === 'mediation'
                                                                            ? 'text-yellow-400 border-yellow-500'
                                                                            : 'text-error border-error'
                                                                    }`}>
                                                                        {order.status === 'completed' || order.status === 'settled' ? 'SETTLED' : order.status === 'mediation' ? 'MEDIATION' : 'DISPUTED'}
                                                                    </span>
                                                                </div>
                                                                {(order.status === 'disputed' || order.status === 'mediation') && (
                                                                    <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${expandedDispute === order.id ? 'rotate-180' : ''}`} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    
                                                        {/* Stake lock status */}
                                                        {order.stakeLockExpiresAt && order.stakeLockExpiresAt > Date.now() && (
                                                            <div className="mt-2 text-[10px] text-warning uppercase font-mono flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                STAKE_LOCKED: {Math.ceil((order.stakeLockExpiresAt - Date.now()) / (1000 * 60 * 60))}h remaining
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* ===== Expanded Dispute Detail (LP View) ===== */}
                                                    {(order.status === 'disputed' || order.status === 'mediation') && expandedDispute === order.id && (
                                                        <div className="border-t border-red-500/20 p-4 space-y-3">
                                                            {/* Order details grid */}
                                                            <div className="bg-background border border-border p-3">
                                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                                    <div>
                                                                        <div className="text-text-secondary text-xs">Amount</div>
                                                                        <div className="text-text-primary font-bold">${order.amountUsdc?.toFixed(2) || '0.00'} USDC</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-text-secondary text-xs">Fiat</div>
                                                                        <div className="text-text-primary font-bold">{order.fiatCurrency || 'INR'} {order.amountFiat?.toFixed(0) || 'N/A'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-text-secondary text-xs">Payment Method</div>
                                                                        <div className="text-text-primary">{order.paymentMethod || 'UPI'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-text-secondary text-xs">Type</div>
                                                                        <div className="text-text-primary uppercase">{order.type || 'N/A'}</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Evidence / Proof Images */}
                                                            <div className="space-y-2">
                                                                <div className="text-[10px] text-text-secondary uppercase font-mono">Evidence & Proof</div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="bg-background border border-border p-2">
                                                                        <div className="text-[10px] text-text-secondary mb-1 flex items-center gap-1">
                                                                            <ImageIcon className="w-3 h-3" /> Buyer QR / Screenshot
                                                                        </div>
                                                                        {order.qrImage ? (
                                                                            <img src={order.qrImage} alt="Buyer QR" className="w-full h-32 object-contain bg-white rounded" />
                                                                        ) : (
                                                                            <div className="h-32 flex items-center justify-center text-xs text-text-secondary">No QR uploaded</div>
                                                                        )}
                                                                    </div>
                                                                    <div className="bg-background border border-border p-2">
                                                                        <div className="text-[10px] text-text-secondary mb-1 flex items-center gap-1">
                                                                            <ImageIcon className="w-3 h-3" /> LP Payment Proof
                                                                        </div>
                                                                        {order.lpPaymentProof ? (
                                                                            <img src={order.lpPaymentProof} alt="LP Proof" className="w-full h-32 object-contain bg-white rounded" />
                                                                        ) : (
                                                                            <div className="h-32 flex items-center justify-center text-xs text-text-secondary">No proof uploaded</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Addresses */}
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div className="bg-background border border-border rounded p-2">
                                                                    <div className="text-text-secondary">Buyer</div>
                                                                    <div className="text-text-primary font-mono truncate">{order.userAddress || 'N/A'}</div>
                                                                </div>
                                                                <div className="bg-background border border-border rounded p-2">
                                                                    <div className="text-text-secondary">LP / Solver</div>
                                                                    <div className="text-text-primary font-mono truncate">{order.solverAddress || 'N/A'}</div>
                                                                </div>
                                                            </div>

                                                            {/* Timeline */}
                                                            <div className="bg-background border border-border p-2 text-xs space-y-1">
                                                                <div className="text-[10px] text-text-secondary uppercase font-mono mb-1">Timeline</div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-text-secondary">Created</span>
                                                                    <span className="text-text-primary">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</span>
                                                                </div>
                                                                {order.matchedAt && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-text-secondary">Matched</span>
                                                                        <span className="text-text-primary">{new Date(order.matchedAt).toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                                {order.paymentSentAt && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-text-secondary">Payment Sent</span>
                                                                        <span className="text-text-primary">{new Date(order.paymentSentAt).toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                                {order.disputePeriodEndsAt && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-text-secondary">Dispute Window</span>
                                                                        <span className="text-text-primary">Until {new Date(order.disputePeriodEndsAt).toLocaleString()}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Dispute reason */}
                                                            {order.disputeReason && (
                                                                <div className="bg-red-500/10 border border-red-500/20 p-2">
                                                                    <div className="text-[10px] text-red-400 uppercase font-mono mb-1">Dispute Reason</div>
                                                                    <div className="text-sm text-text-primary">{order.disputeReason}</div>
                                                                </div>
                                                            )}

                                                            {/* Mediation info if scheduled */}
                                                            {order.status === 'mediation' && order.meetLink && (
                                                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3">
                                                                    <div className="text-[10px] text-yellow-400 uppercase font-mono mb-2">Mediation Scheduled</div>
                                                                    <a
                                                                        href={order.meetLink}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-sm text-brand underline break-all"
                                                                    >
                                                                        {order.meetLink}
                                                                    </a>
                                                                    {order.mediationEmail && (
                                                                        <div className="text-xs text-text-secondary mt-2">
                                                                            Contact: <span className="text-yellow-400 font-mono">{order.mediationEmail}</span>
                                                                        </div>
                                                                    )}
                                                                    {order.mediationScheduledAt && (
                                                                        <div className="text-xs text-text-secondary mt-1">
                                                                            Scheduled: {new Date(order.mediationScheduledAt).toLocaleString()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Join Meet button */}
                                                            {order.meetLink && (
                                                                <a
                                                                    href={order.meetLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="w-full py-3 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm font-bold uppercase hover:bg-yellow-500/30 transition-colors flex items-center justify-center gap-2"
                                                                >
                                                                    <Calendar className="w-4 h-4" />
                                                                    Join Mediation Meet
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </a>
                                                            )}

                                                            {/* Status info for LP */}
                                                            {order.status === 'disputed' && !order.meetLink && (
                                                                <div className="bg-orange-500/10 border border-orange-500/20 p-3 text-center">
                                                                    <AlertTriangle className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                                                                    <p className="text-xs text-orange-400 uppercase font-mono">Under Review</p>
                                                                    <p className="text-[10px] text-text-secondary mt-1">Admin is reviewing this dispute. You will be notified of the resolution.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Step: Waiting for QR */}
            {step === "waiting_qr" && acceptedOrder && (
                <div className="font-mono">
                    <div className="border border-warning bg-warning/5 p-6 mb-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-warning/20">
                            <div className="h-full bg-warning animate-loading-bar"></div>
                        </div>
                        <h2 className="text-lg font-bold text-warning mb-2 uppercase">AWAITING_USER_INPUT</h2>
                        <p className="text-xs text-text-secondary uppercase mb-4">
                            {">"} TARGET_USER_UPLOADING_QR...<br />
                            {">"} STANDBY_FOR_IMAGE_DATA
                        </p>
                        <Clock className="w-8 h-8 text-warning mx-auto animate-pulse" />
                    </div>

                    <div className="border border-border bg-card p-4 mb-6">
                        <div className="flex justify-between border-b border-border border-dashed pb-2 mb-2">
                            <span className="text-xs text-text-secondary">CONTRACT_VAL</span>
                            <span className="font-bold">{formatCurrency(acceptedOrder.amountFiat, acceptedOrder.fiatCurrency)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-text-secondary">PAYOUT</span>
                            <span className="font-bold text-brand">{acceptedOrder.amountUsdc?.toFixed(2)} USDC</span>
                        </div>
                    </div>

                    <button
                        onClick={async () => {
                            try {
                                await fetch('/api/orders', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        orderId: acceptedOrder.id,
                                        action: 'cancel',
                                    }),
                                })
                            } catch (e) {
                                console.error('Failed to cancel order:', e)
                            }
                            setAcceptedOrder(null)
                            setStep("browse")
                        }}
                        className="w-full py-3 border border-error/50 text-error font-bold uppercase text-xs hover:bg-error/10"
                    >
                        ABORT_CONTRACT
                    </button>
                </div>
            )}

            {/* Step: Pay QR */}
            {step === "pay" && acceptedOrder && (
                <div className="font-mono">
                    <div className="border-l-2 border-brand pl-4 py-2 mb-6 bg-brand/5">
                        <h2 className="text-lg font-bold text-brand uppercase">CONTRACT_ACTIVE</h2>
                        <p className="text-[10px] text-text-secondary uppercase">
                            {">"} EXECUTE_PAYMENT_TO_PROCEED<br />
                            {">"} UPLOAD_PROOF_FOR_VERIFICATION
                        </p>
                    </div>

                    {/* QR Display Area */}
                    <div className="border border-border bg-black p-4 mb-4 text-center">
                        <p className="text-[10px] text-text-secondary uppercase mb-2 border-b border-border border-dashed pb-2">TARGET_PAYMENT_GATEWAY</p>

                        {acceptedOrder.qrImage ? (
                            <div className="bg-white p-4 inline-block mx-auto mb-4 border-2 border-brand">
                                <img src={acceptedOrder.qrImage} alt="Payment QR" className="max-h-64 object-contain" />
                            </div>
                        ) : scannedQrData ? (
                            <div className="bg-surface p-4 border border-brand/50 mb-4 text-left">
                                <p className="text-[10px] text-brand mb-1">DECODED_UPI_STRING:</p>
                                <code className="text-xs break-all text-white">{scannedQrData}</code>
                            </div>
                        ) : (
                            <div className="py-8 text-center border border-border border-dashed mb-4">
                                <p className="text-xs text-text-secondary mb-2">{">"} NO_IMG_DATA_FOUND</p>
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="px-4 py-2 bg-surface border border-brand text-brand text-xs font-bold uppercase hover:bg-brand hover:text-black"
                                >
                                    [ ACTIVATE_CAMERA_SCAN ]
                                </button>
                            </div>
                        )}

                        <div className="flex justify-between items-center text-xs border-t border-border border-dashed pt-2">
                            <span className="text-text-secondary">AMOUNT_DUE:</span>
                            <span className="font-bold text-xl">{formatCurrency(acceptedOrder.amountFiat, acceptedOrder.fiatCurrency)}</span>
                        </div>
                    </div>

                    {/* Mobile Camera Button (if needed again) */}
                    {acceptedOrder.qrImage && (
                        <button
                            onClick={() => setShowScanner(true)}
                            className="w-full py-3 mb-4 border border-border bg-surface text-text-secondary text-xs uppercase hover:text-brand hover:border-brand"
                        >
                            [ RE-SCAN_USER_QR ]
                        </button>
                    )}

                    <button
                        onClick={() => setStep("proof")}
                        className="w-full py-4 bg-brand text-black font-bold uppercase tracking-wider hover:bg-brand-hover relative overflow-hidden group"
                    >
                        <span className="relative z-10">CONFIRM_PAYMENT_SENT {">>"}</span>
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
                    </button>
                </div>
            )}

            {/* Step: Upload Proof */}
            {step === "proof" && acceptedOrder && (
                <div className="font-mono">
                    <h2 className="text-lg font-bold mb-4 uppercase text-brand">VERIFICATION_PHASE</h2>

                    <div className="border border-border bg-card p-1 mb-6">
                        {!paymentProof ? (
                            <div className="aspect-video w-full bg-surface/50 border-2 border-dashed border-border flex flex-col items-center justify-center p-4">
                                <Upload className="w-10 h-10 text-brand mb-3" />
                                <p className="text-xs text-text-secondary uppercase mb-2">ATTACH_PAYMENT_SCREENSHOT</p>
                                <p className="text-[10px] text-text-secondary/60 mb-4 text-center">Upload screenshot showing payment confirmation</p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-3 border border-brand text-brand hover:bg-brand hover:text-black transition-colors uppercase text-xs font-bold"
                                >
                                    [ SELECT_FILE ]
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <img
                                    src={paymentProof}
                                    alt="Payment proof"
                                    className="w-full max-h-[300px] object-contain bg-black"
                                />
                                <button
                                    onClick={() => setPaymentProof(null)}
                                    className="absolute top-2 right-2 p-2 bg-black/80 text-error hover:bg-error hover:text-white border border-error transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-warning/10 border border-warning text-warning p-4 mb-6 text-xs">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5" />
                            <div>
                                <p className="font-bold uppercase">DISPUTE_PROTOCOL_ACTIVE</p>
                                <p className="opacity-80 mt-1">
                                    {">"} 24HR_SETTLEMENT_PERIOD_INITIATED<br />
                                    {">"} FUNDS_LOCKED_UNTIL_VERIFIED
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setStep("pay")}
                            className="py-3 border border-border text-text-secondary uppercase text-xs hover:bg-surface"
                        >
                            {"<< BACK"}
                        </button>
                        <button
                            onClick={handleSubmitProof}
                            disabled={!paymentProof || isSubmitting}
                            className="py-3 bg-brand text-black font-bold uppercase text-xs hover:bg-brand-hover disabled:opacity-50"
                        >
                            {isSubmitting ? "UPLOADING..." : "SUBMIT_EVIDENCE"}
                        </button>
                    </div>
                </div>
            )}

            {/* Step: Pending DAO Verification */}
            {step === "pending" && acceptedOrder && (
                <div className="font-mono text-center pt-8">
                    <div className="w-24 h-24 border-2 border-brand rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <div className="absolute inset-0 border-2 border-brand rounded-full animate-ping opacity-20"></div>
                        <Clock className="w-10 h-10 text-brand" />
                    </div>

                    <h2 className="text-xl font-bold uppercase text-white mb-2">VALIDATING_PAYMENT</h2>
                    <p className="text-xs text-text-secondary uppercase mb-2">DAO validators are reviewing your proof</p>

                    <div className="border border-border bg-surface p-4 text-left max-w-sm mx-auto mb-6">
                        <div className="flex justify-between mb-2 pb-2 border-b border-border border-dashed">
                            <span className="text-xs text-text-secondary">ORDER_ID</span>
                            <span className="text-xs font-mono">{acceptedOrder.id.slice(0, 8)}...</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-xs text-text-secondary">PAID</span>
                            <span className="font-bold">{formatCurrency(acceptedOrder.amountFiat, acceptedOrder.fiatCurrency)}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-xs text-text-secondary">PENDING_CREDIT</span>
                            <span className="font-bold text-brand">{acceptedOrder.amountUsdc.toFixed(2)} USDC</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-text-secondary">STATUS</span>
                            <span className="text-xs text-yellow-400 uppercase">VERIFYING</span>
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 max-w-sm mx-auto mb-6 text-left">
                        <p className="text-[10px] text-yellow-400 uppercase">
                            {">"} Community validators checking payment proof<br />
                            {">"} Once 2/3 approve, USDC released instantly<br />
                            {">"} Auto-approved in 1 hour if no quorum
                        </p>
                    </div>

                    <p className="text-[10px] text-text-secondary opacity-50">
                        {">"} DAO_VALIDATION_IN_PROGRESS...<br />
                        {">"} DO_NOT_CLOSE_BROWSER
                    </p>
                </div>
            )}

            {/* Step: Settled - Success! */}
            {step === "settled" && acceptedOrder && (
                <div className="font-mono text-center pt-8">
                    <div className="w-24 h-24 border-2 border-success bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                        <Gift className="w-10 h-10 text-success" />
                    </div>

                    <h2 className="text-2xl font-bold uppercase text-success mb-2">PAYOUT_COMPLETE</h2>
                    <p className="text-xs text-text-secondary uppercase mb-8">FUNDS_SECURED_IN_WALLET</p>

                    <div className="grid grid-cols-2 gap-px bg-border border border-border mb-8 text-left">
                        <div className="bg-black p-4">
                            <p className="text-[10px] text-text-secondary uppercase mb-1">INPUT (FIAT)</p>
                            <p className="text-lg font-bold">{formatCurrency(acceptedOrder.amountFiat, acceptedOrder.fiatCurrency)}</p>
                        </div>
                        <div className="bg-black p-4">
                            <p className="text-[10px] text-text-secondary uppercase mb-1">OUTPUT (USDC)</p>
                            <p className="text-lg font-bold text-success">+{acceptedOrder.amountUsdc.toFixed(2)}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setAcceptedOrder(null)
                            setStep("browse")
                            setPaymentProof(null)
                        }}
                        className="w-full py-4 bg-brand text-black font-bold uppercase hover:bg-brand-hover"
                    >
                        [ CONTINUE_OPERATIONS ]
                    </button>
                </div>
            )}

            <BottomNav />

            {/* QR Scanner Modal */}
            {showScanner && (
                <QRScanner
                    onScan={async (data) => {
                        console.log("[Solver] Scanned:", data)
                        setScannedQrData(data)
                        setShowScanner(false)

                        // If we scanned a UPI string, generate a QR for display
                        if (data.startsWith("upi://") || data.includes("@")) {
                            try {
                                const QRCode = (await import('qrcode')).default
                                const qrDataUrl = await QRCode.toDataURL(data, {
                                    width: 256,
                                    margin: 2
                                })
                                // Update local state for display so LP can scan it with another phone if needed
                                // We don't save this to the order yet, just local display helper
                                if (acceptedOrder) {
                                    setAcceptedOrder({
                                        ...acceptedOrder,
                                        qrImage: qrDataUrl
                                    })
                                }
                            } catch (e) {
                                console.error("Failed to generate QR from scan", e)
                            }
                        }
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    )
}
