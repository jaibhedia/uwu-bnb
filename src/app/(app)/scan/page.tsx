"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, DollarSign, Clock, Upload, Check, Loader2, User, Camera, QrCode, Home, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BottomNav } from "@/components/app/bottom-nav"
import { QRScanner } from "@/components/app/qr-scanner"
import { Numpad } from "@/components/app/numpad"
import { useWallet } from "@/hooks/useWallet"
import { useStaking } from "@/hooks/useStaking"
import { USER_MAX_ORDER_USDC } from "@/hooks/useUserLimits"
import { formatCurrency } from "@/lib/currency-converter"
import { Order } from "@/app/api/orders/sse/route"
import { useSafeNavigation } from "@/hooks/useSafeNavigation"
import { saveOrderToLocal } from "@/app/(app)/orders/page"

/**
 * Scan & Pay - Amount-First Order Creation
 * 
 * New Flow:
 * 1. Enter amount (INR) you want to receive
 * 2. Submit -> Order broadcasts to LPs
 * 3. Wait for LP to accept
 * 4. AFTER matched -> Provide your UPI QR
 * 5. LP pays -> Uploads proof -> Done!
 */

type Step = "amount" | "waiting" | "matched" | "pending" | "verifying" | "complete"

export default function ScanPage() {
    const router = useRouter()
    const { goBack, goHome } = useSafeNavigation()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { isConnected, address, displayName, balance } = useWallet()
    const { stakeProfile, fetchStakeProfile } = useStaking()
    const [mounted, setMounted] = useState(false)

    const [step, setStep] = useState<Step>("amount")
    const [amount, setAmount] = useState("0")
    const [orderId, setOrderId] = useState<string | null>(null)
    const [order, setOrder] = useState<Order | null>(null)
    const [qrImage, setQrImage] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showScanner, setShowScanner] = useState(false) // For live camera QR capture
    const [liveRate, setLiveRate] = useState<number>(83.50) // Default, will be fetched

    useEffect(() => {
        setMounted(true)
        // Fetch live rate
        const fetchRate = async () => {
            try {
                const { fetchLiveRates } = await import('@/lib/currency-converter')
                const rates = await fetchLiveRates()
                setLiveRate(rates.INR || 83.50)
            } catch {
                setLiveRate(83.50)
            }
        }
        fetchRate()
        if (address) fetchStakeProfile()
    }, [address])

    // Poll for order updates when waiting
    useEffect(() => {
        if (!orderId || step === "complete" || !address) return

        const checkOrder = async () => {
            try {
                const res = await fetch(`/api/orders?orderId=${orderId}`)
                const data = await res.json()
                if (data.success && data.orders?.[0]) {
                    const updatedOrder = data.orders[0]
                    setOrder(updatedOrder)
                    // Update localStorage with latest status
                    saveOrderToLocal(address, updatedOrder)

                    if (updatedOrder.status === "matched" && step === "waiting") {
                        setStep("matched")
                    } else if (updatedOrder.status === "verifying") {
                        // DAO validators are reviewing LP's payment proof
                        setStep("verifying")
                    } else if (["payment_sent", "completed", "settled"].includes(updatedOrder.status)) {
                        // LP submitted payment proof - order is done
                        setStep("complete")
                    }
                }
            } catch (error) {
                console.error("Failed to check order:", error)
            }
        }

        checkOrder()
        const interval = setInterval(checkOrder, 3000)
        return () => clearInterval(interval)
    }, [orderId, step, address])

    const fiatAmount = parseFloat(amount) || 0
    const usdcAmount = fiatAmount / liveRate // Live INR to USDC rate

    // Limit check: users = $150 USDC, LPs = staked USDC
    const isLP = stakeProfile?.isLP && stakeProfile.baseStake > 0
    const maxOrderUsdc = isLP ? stakeProfile!.baseStake : USER_MAX_ORDER_USDC
    const orderExceedsLimit = usdcAmount > maxOrderUsdc

    // Step 1: Create order with amount only
    const handleCreateOrder = async () => {
        if (!address || fiatAmount <= 0 || orderExceedsLimit) return

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: address,
                    userAddress: address,
                    type: "sell",
                    amountUsdc: usdcAmount,
                    amountFiat: fiatAmount,
                    fiatCurrency: "INR",
                    paymentMethod: "UPI",
                    paymentDetails: "Pending QR upload",
                    // No QR yet - will be provided after LP match
                }),
            })

            const data = await res.json()
            if (data.success) {
                setOrderId(data.order.id)
                setOrder(data.order)
                // Save to localStorage for persistence
                saveOrderToLocal(address, data.order)
                setStep("waiting")
            } else {
                alert("Failed to create order: " + data.error)
            }
        } catch (error) {
            console.error("Order creation failed:", error)
            alert("Failed to create order")
        } finally {
            setIsSubmitting(false)
        }
    }

    // Step 3: Upload QR after LP match
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            setQrImage(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    // Submit QR to order
    const handleSubmitQr = async () => {
        if (!orderId || !qrImage) return

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId,
                    action: "add_qr",
                    qrImage,
                }),
            })

            const data = await res.json()
            if (data.success) {
                setOrder(data.order)
                setStep("pending")
            }
        } catch (error) {
            console.error("Failed to submit QR:", error)
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

    if (!isConnected) {
        // Route guard handles redirect, this is just a fallback loading state
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen flex items-center justify-center">
                <div className="text-center font-mono">
                    <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-4" />
                    <p className="text-text-secondary text-sm uppercase">Loading...</p>
                </div>
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
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 text-text-secondary hover:text-brand transition-colors uppercase text-xs tracking-wider"
                >
                    <ChevronLeft className="w-4 h-4" />
                    [BACK]
                </button>
                <div className="text-center">
                    <h1 className="text-lg font-bold uppercase text-brand">SCAN & PAY</h1>
                    <p className="text-[10px] text-text-secondary uppercase">SELL INR → GET USDC</p>
                </div>
                <button onClick={goHome} className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-brand">
                    <Home className="w-4 h-4" />
                </button>
            </div>

            {/* Step Progress Bar */}
            {step !== "amount" && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        {(["amount", "waiting", "matched", "pending", "verifying", "complete"] as Step[]).map((s, i) => {
                            const stepNames = ["Amount", "Finding LP", "Upload QR", "Payment", "Verifying", "Done"]
                            const currentIdx = ["amount", "waiting", "matched", "pending", "verifying", "complete"].indexOf(step)
                            const isActive = i <= currentIdx
                            return (
                                <div key={s} className="flex-1 flex flex-col items-center">
                                    <div className={`w-3 h-3 rounded-full border-2 ${i < currentIdx ? 'bg-brand border-brand' :
                                        i === currentIdx ? 'bg-brand/50 border-brand animate-pulse' :
                                            'bg-transparent border-border'
                                        }`} />
                                    <span className={`text-[8px] mt-1 uppercase ${isActive ? 'text-brand' : 'text-text-secondary/50'
                                        }`}>{stepNames[i]}</span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="h-px bg-border" />
                </div>
            )}

            {/* Compact User Info */}
            <div className="bg-black border border-border p-2 mb-6 flex items-center justify-between font-mono">
                <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-brand" />
                    <span className="text-[10px] text-white uppercase">{displayName}</span>
                </div>
                <span className="text-[10px] text-brand font-bold">${balance.toFixed(2)} USDC</span>
            </div>

            {/* Step 1: Enter Amount */}
            {step === "amount" && (
                <>
                    <div className="bg-black border border-brand/50 p-4 mb-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-[10px] uppercase text-brand">INPUT_STREAM</span>
                        </div>

                        <label className="text-[10px] text-brand uppercase block mb-2 font-mono truncate">
                            {">"}  ENTER_REQUEST_AMOUNT (INR):
                        </label>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-gray-500 font-mono">₹</span>
                            <span className="text-4xl font-bold font-mono text-white">
                                {amount === "0" ? "_" : amount}
                            </span>
                        </div>
                        {fiatAmount > 0 && (
                            <div className="bg-surface/50 border-t border-dashed border-border p-2 -mx-4 -mb-4 mt-4 px-4">
                                <div className="flex justify-between items-center mb-1 gap-2">
                                    <span className="text-[10px] text-text-secondary uppercase shrink-0">ESTIMATED_COST</span>
                                    <span className="text-xs font-mono text-brand font-bold">
                                        ≈ {usdcAmount.toFixed(2)} USDC
                                    </span>
                                </div>
                                {usdcAmount < 10 && usdcAmount > 0 && (
                                    <div className="flex justify-between items-center border-t border-border/50 pt-1 mt-1 gap-2">
                                        <span className="text-[10px] text-yellow-500 uppercase shrink-0">SMALL_ORDER_FEE</span>
                                        <span className="text-xs font-mono text-yellow-500 font-bold">
                                            +$0.125 USDC
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Numpad */}
                    <div className="mb-4">
                        <Numpad value={amount} onChange={setAmount} />
                    </div>

                    <div className="bg-brand/5 border border-brand/20 p-4 mb-6 font-mono">
                        <p className="text-[10px] text-brand font-bold mb-2 uppercase border-b border-brand/20 pb-1">HOW IT WORKS</p>
                        <ol className="text-[10px] text-text-secondary space-y-2 list-none">
                            <li>01. Enter how much INR you want</li>
                            <li>02. Wait for a provider to match</li>
                            <li>03. Share your UPI QR code</li>
                            <li>04. Provider pays you → Get USDC!</li>
                        </ol>
                    </div>

                    {/* Limit Warning */}
                    {orderExceedsLimit && fiatAmount > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 p-3 mb-4 font-mono">
                            <p className="text-[10px] text-red-400 font-bold uppercase">ORDER_LIMIT_EXCEEDED</p>
                            <p className="text-[10px] text-text-secondary mt-1">
                                {">"} Max per order: ${maxOrderUsdc} USDC
                                {isLP ? ` (your stake)` : ' (user limit)'}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={handleCreateOrder}
                        disabled={fiatAmount <= 0 || isSubmitting || orderExceedsLimit}
                        className="w-full py-4 bg-brand text-black font-bold uppercase tracking-wider text-sm hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed font-mono relative overflow-hidden"
                    >
                        {isSubmitting ? (
                            <span className="animate-pulse">{">"} SEARCHING...</span>
                        ) : (
                            <span>{">"} FIND PROVIDER</span>
                        )}
                        {!isSubmitting && <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />}
                    </button>
                </>
            )}

            {/* Step 2: Waiting for Provider */}
            {step === "waiting" && (
                <div className="text-center py-12 font-mono">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 border-2 border-brand/20 rounded-full"></div>
                        <div className="absolute inset-0 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 m-auto w-16 h-16 bg-brand/5 rounded-full flex items-center justify-center animate-pulse">
                            <Clock className="w-8 h-8 text-brand" />
                        </div>
                    </div>

                    <h2 className="text-lg font-bold mb-2 uppercase text-white tracking-widest">Finding Provider</h2>
                    <p className="text-xs text-text-secondary mb-8 uppercase animate-pulse">
                        Searching for someone to fulfill your order...<br />
                        This usually takes a few seconds
                    </p>

                    <div className="bg-black border border-border p-4 max-w-xs mx-auto text-left">
                        <div className="flex justify-between mb-2">
                            <span className="text-[10px] text-text-secondary uppercase">Amount</span>
                            <span className="font-bold text-sm">₹{fiatAmount.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border border-dashed pt-2 mb-4">
                            <span className="text-[10px] text-text-secondary uppercase">Order ID</span>
                            <span className="font-mono text-[10px] text-brand">{orderId?.slice(0, 12)}...</span>
                        </div>
                    </div>

                    {/* Cancel Order */}
                    <button
                        onClick={async () => {
                            if (!orderId) return
                            try {
                                await fetch('/api/orders', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ orderId, action: 'cancel' })
                                })
                            } catch { }
                            setStep('amount')
                            setOrderId(null)
                            setOrder(null)
                            setAmount('')
                        }}
                        className="mt-6 text-xs text-error uppercase hover:underline font-mono"
                    >
                        [ CANCEL_ORDER ]
                    </button>
                </div>
            )}

            {/* Step 3: Provider Matched - Upload QR */}
            {step === "matched" && order && (
                <div className="font-mono">
                    <div className="bg-success/10 border border-success/30 p-4 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-success"></div>
                        <div className="flex items-center gap-3 mb-1">
                            <Check className="w-4 h-4 text-success" />
                            <p className="font-bold text-success uppercase text-sm">Provider Found!</p>
                        </div>
                        <p className="text-[10px] text-text-secondary uppercase">
                            Now share your UPI QR code<br />
                            Provider will pay you directly
                        </p>
                    </div>

                    <div className="bg-black border border-border p-4 mb-6">
                        <div className="flex justify-between mb-2">
                            <span className="text-[10px] text-text-secondary uppercase">PEER_ID</span>
                            <span className="font-mono text-xs text-white">{order.solverId?.slice(0, 10)}...</span>
                        </div>
                        <div className="flex justify-between border-t border-border border-dashed pt-2">
                            <span className="text-[10px] text-text-secondary uppercase">TARGET_AMOUNT</span>
                            <span className="font-bold text-lg text-brand">₹{fiatAmount.toFixed(0)}</span>
                        </div>
                    </div>

                    {!qrImage ? (
                        <div className="space-y-4 mb-6">
                            {/* Upload from gallery */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square w-full max-w-xs mx-auto bg-black border-2 border-dashed border-border hover:border-brand flex flex-col items-center justify-center cursor-pointer group transition-all"
                            >
                                <Upload className="w-10 h-10 text-text-secondary mb-3 group-hover:text-brand transition-colors" />
                                <p className="text-xs font-bold text-text-secondary uppercase group-hover:text-brand">SELECT_IMAGE_FILE</p>
                                <p className="text-[10px] text-text-secondary opacity-50 mt-1 uppercase">[ FROM_DEVICE ]</p>
                            </div>

                            {/* Or use camera */}
                            <div className="flex items-center gap-3 px-8">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-[10px] text-text-secondary uppercase">OR</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            <button
                                onClick={() => setShowScanner(true)}
                                className="w-full max-w-xs mx-auto py-3 bg-surface border border-brand/50 text-brand text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-brand/10 transition-colors"
                            >
                                <Camera className="w-4 h-4" />
                                [ ENGAGE_CAMERA_SCAN ]
                            </button>
                        </div>
                    ) : (
                        <div className="mb-6 relative">
                            <div className="border-2 border-brand p-1 bg-black inline-block mx-auto w-full">
                                <img
                                    src={qrImage}
                                    alt="Your UPI QR"
                                    className="max-h-64 mx-auto object-contain bg-white"
                                />
                            </div>
                            <button
                                onClick={() => setQrImage(null)}
                                className="mt-3 text-[10px] text-error uppercase hover:underline block w-full text-center"
                            >
                                [ DISCARD_IMAGE ]
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleSubmitQr}
                        disabled={!qrImage || isSubmitting}
                        className="w-full py-4 bg-brand text-black font-bold uppercase tracking-wider text-sm rounded-none disabled:opacity-50 hover:bg-brand-hover transition-colors"
                    >
                        {isSubmitting ? "TRANSMITTING..." : "CONFIRM_DATA_UPLOAD"}
                    </button>
                </div>
            )}

            {/* Step 4: Pending - Wait for Provider payment */}
            {step === "pending" && order && (
                <div className="text-center py-12 font-mono">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-2 border-warning/20 rounded-full"></div>
                        <div className="absolute inset-0 border-2 border-warning border-t-transparent rounded-full animate-spin"></div>
                        <DollarSign className="absolute inset-0 m-auto w-8 h-8 text-warning animate-pulse" />
                    </div>

                    <h2 className="text-lg font-bold mb-2 uppercase text-warning tracking-widest">Payment In Progress</h2>
                    <p className="text-xs text-text-secondary mb-8 uppercase">
                        Provider is sending payment to your UPI...<br />
                        Hold tight!
                    </p>

                    <div className="bg-black border border-border p-4 text-left">
                        <div className="flex justify-between mb-2">
                            <span className="text-[10px] text-text-secondary uppercase">Amount</span>
                            <span className="font-bold text-white">₹{fiatAmount.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[10px] text-text-secondary uppercase">Status</span>
                            <span className="text-[10px] text-warning font-bold uppercase bg-warning/10 px-2 py-0.5">Processing</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Step: Verifying — DAO validators reviewing */}
            {step === "verifying" && order && (
                <div className="text-center py-12 font-mono">
                    <div className="w-24 h-24 border-2 border-yellow-400 bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                        <div className="absolute inset-0 border-2 border-yellow-400 rounded-full animate-ping opacity-20"></div>
                        <Shield className="w-10 h-10 text-yellow-400" />
                    </div>

                    <h2 className="text-2xl font-bold uppercase text-yellow-400 mb-2">VERIFYING_PAYMENT</h2>
                    <p className="text-xs text-text-secondary uppercase mb-6">Community validators reviewing LP proof</p>

                    <div className="border border-border bg-surface p-4 text-left max-w-sm mx-auto mb-6">
                        <div className="flex justify-between mb-2 pb-2 border-b border-border border-dashed">
                            <span className="text-xs text-text-secondary uppercase">Amount</span>
                            <span className="font-bold text-brand">{order.amountUsdc.toFixed(2)} USDC</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-xs text-text-secondary uppercase">Status</span>
                            <span className="text-xs text-yellow-400 uppercase">Validators Reviewing</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-xs text-text-secondary uppercase">ETA</span>
                            <span className="text-xs text-text-primary">Usually under 5 mins</span>
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 max-w-sm mx-auto mb-6">
                        <p className="text-[10px] text-yellow-400 uppercase">
                            {">"} LP submitted payment proof<br />
                            {">"} 3 community validators must approve<br />
                            {">"} Your USDC releases automatically after approval
                        </p>
                    </div>

                    <p className="text-[10px] text-text-secondary/50">
                        {">"} DAO_VALIDATION_IN_PROGRESS...
                    </p>
                </div>
            )}

            {/* Step 5: Complete */}
            {step === "complete" && order && (
                <div className="text-center py-12 font-mono">
                    <div className="w-24 h-24 border-2 border-success bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                        <Check className="w-10 h-10 text-success" />
                    </div>

                    <h2 className="text-xl font-bold text-success mb-2 uppercase tracking-widest">Payment Complete!</h2>
                    <p className="text-xs text-text-secondary mb-8 uppercase">
                        Check your UPI app for the payment<br />
                        <span className="block mt-2 text-white font-bold">₹{fiatAmount.toFixed(0)} received</span>
                    </p>

                    {order.lpPaymentProof && (
                        <div className="mb-8 border border-border p-2 bg-black inline-block">
                            <p className="text-[10px] text-text-secondary uppercase mb-2 text-left w-full border-b border-border border-dashed pb-1">Payment Proof</p>
                            <img
                                src={order.lpPaymentProof}
                                alt="Payment proof"
                                className="max-h-48 mx-auto border border-border"
                            />
                        </div>
                    )}

                    <div className="space-y-3">
                        <Link
                            href="/orders"
                            className="block w-full py-4 bg-brand text-black font-bold uppercase tracking-wider text-sm hover:bg-brand-hover transition-colors"
                        >
                            View My Orders
                        </Link>
                        <Link
                            href="/dashboard"
                            className="block w-full py-3 bg-transparent border border-border text-text-secondary font-bold uppercase text-xs hover:text-white hover:border-white transition-colors"
                        >
                            Back to Home
                        </Link>
                    </div>
                </div>
            )}

            <BottomNav />

            {/* QR Scanner Modal */}
            {showScanner && (
                <QRScanner
                    onScan={async (data) => {
                        console.log("[Scan] Scanned QR data:", data)
                        setShowScanner(false)

                        // Generate QR image from scanned data using canvas
                        try {
                            const QRCode = (await import('qrcode')).default
                            const qrDataUrl = await QRCode.toDataURL(data, {
                                width: 256,
                                margin: 2,
                                color: { dark: '#000000', light: '#ffffff' }
                            })
                            setQrImage(qrDataUrl)

                            // Auto-submit if we have an order
                            if (orderId) {
                                setIsSubmitting(true)
                                const res = await fetch("/api/orders", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        orderId,
                                        action: "add_qr",
                                        qrImage: qrDataUrl,
                                    }),
                                })
                                const result = await res.json()
                                if (result.success) {
                                    setOrder(result.order)
                                    setStep("pending")
                                }
                                setIsSubmitting(false)
                            }
                        } catch (err) {
                            console.error("Failed to generate QR:", err)
                            // Fallback: just store the raw data
                            setQrImage(data)
                        }
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    )
}
