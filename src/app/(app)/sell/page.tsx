"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, AlertCircle, CheckCircle, Loader2, Send, Shield } from "lucide-react"
import Link from "next/link"
import { Numpad } from "@/components/app/numpad"
import { WalletConnect } from "@/components/app/wallet-connect"
import { useWallet } from "@/hooks/useWallet"
import { useUserOrders, Order } from "@/hooks/useOrders"
import { useFraudProfile } from "@/hooks/useFraudProfile"
import { useStaking } from "@/hooks/useStaking"
import { USER_MAX_ORDER_USDC } from "@/hooks/useUserLimits"
import { usdcToFiat, formatCurrency } from "@/lib/currency-converter"
import { useRouter } from "next/navigation"
import { RiskIndicator, StakeRequirement, OrderBlockedWarning } from "@/components/app/risk-indicator"
import { PaymentProofUpload } from "@/components/app/payment-proof-upload"
import { PLATFORM_CONFIG, calculateRequiredStake } from "@/lib/platform-config"

/**
 * Sell Page - Simplified Flow (Terminal Style)
 * 
 * User Flow:
 * 1. Enter USDC amount to sell
 * 2. Enter payment details (UPI, Bank, etc.)
 * 3. Create order -> Broadcasted to solvers via SSE
 * 4. Wait for solver to accept and pay
 * 5. Confirm payment received -> USDC released
 */

export default function SellPage() {
    const router = useRouter()
    const [amount, setAmount] = useState("0")
    const [paymentDetails, setPaymentDetails] = useState("")
    const [step, setStep] = useState<"amount" | "payment" | "waiting" | "verify" | "confirm">("amount")
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
    const [mounted, setMounted] = useState(false)
    const [riskChecked, setRiskChecked] = useState(false)

    const { address, isConnected, balanceFormatted } = useWallet()
    const { orders, createSellOrder, confirmPaymentReceived, cancelOrder, isLoading } = useUserOrders(address || undefined)
    const {
        analyzeOrderRisk,
        riskAssessment,
        riskLevel,
        isLoading: isAnalyzing,
        getRequiredStake
    } = useFraudProfile(address ?? undefined)
    const { stakeProfile, fetchStakeProfile } = useStaking()
    const [liveRate, setLiveRate] = useState<number>(83.50)

    // Fetch live rate
    useEffect(() => {
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
    }, [])

    // Fetch stake profile on mount
    useEffect(() => {
        if (address) {
            fetchStakeProfile()
        }
    }, [address, fetchStakeProfile])

    useEffect(() => {
        setMounted(true)
    }, [])

    const fiatAmount = amount !== "0" ? usdcToFiat(parseFloat(amount), "INR") : 0
    const hasEnoughBalance = parseFloat(amount) <= parseFloat(balanceFormatted)

    // Limit check: users = $150 USDC, LPs = staked USDC
    const isLP = stakeProfile?.isLP && stakeProfile.baseStake > 0
    const maxOrderUsdc = isLP ? stakeProfile!.baseStake : USER_MAX_ORDER_USDC
    const orderExceedsLimit = parseFloat(amount) > maxOrderUsdc

    const handleContinue = async () => {
        if (amount === "0" || parseFloat(amount) <= 0 || !hasEnoughBalance) return

        // Check limit
        if (orderExceedsLimit) {
            return // Show limit warning in UI
        }

        // Run fraud analysis before proceeding
        const assessment = await analyzeOrderRisk({
            amountUsdc: parseFloat(amount),
            paymentMethod: 'upi',
            fiatCurrency: 'INR',
        })

        setRiskChecked(true)

        // Block if risk is too high
        if (assessment?.blocked) {
            return // Show blocked warning in UI
        }

        setStep("payment")
    }

    const handleCreateOrder = async () => {
        if (!address || !paymentDetails) return

        const order = await createSellOrder({
            amountUsdc: parseFloat(amount),
            amountFiat: fiatAmount,
            fiatCurrency: "INR",
            paymentMethod: "UPI",
            paymentDetails,
            userAddress: address,
        })

        if (order) {
            setCurrentOrder(order)
            setStep("waiting")
        }
    }

    // Called when payment proof is verified successfully
    const handlePaymentVerified = () => {
        setStep("confirm")
    }

    const handleConfirmPayment = async () => {
        if (!currentOrder) return
        const success = await confirmPaymentReceived(currentOrder.id)
        if (success) {
            setStep("confirm")
        }
    }

    const handleCancelOrder = async () => {
        if (!currentOrder) return
        await cancelOrder(currentOrder.id)
        setStep("amount")
        setCurrentOrder(null)
        setAmount("0")
    }

    // Polling for order updates when waiting
    useEffect(() => {
        if ((step === "waiting" || step === "verify") && currentOrder) {
            const updatedOrder = orders.find(o => o.id === currentOrder.id)
            if (updatedOrder && updatedOrder.status !== currentOrder.status) {
                setCurrentOrder(updatedOrder)
                // If LP has sent payment, move to verification step
                if (updatedOrder.status === "payment_sent") {
                    setStep("verify")
                }
            }
        }
    }, [orders, currentOrder, step])

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
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
                <div className="flex items-center justify-between mb-8 border-b border-border pb-4 border-dashed">
                    <Link href="/dashboard" className="flex items-center gap-2 text-text-secondary hover:text-brand uppercase text-xs tracking-wider">
                        <ChevronLeft className="w-4 h-4" />
                        [BACK]
                    </Link>
                </div>
                <div className="bg-black border-2 border-brand/50 p-8 text-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-30 text-[10px] uppercase text-brand">ACCESS_DENIED</div>

                    <Send className="w-16 h-16 text-brand mx-auto mb-6 opacity-80" />
                    <h2 className="text-xl font-bold mb-2 uppercase text-white tracking-widest">OFFLOAD_RESTRICTED</h2>
                    <p className="text-sm text-text-secondary font-mono mb-6 max-w-xs mx-auto">
                        {">"} AUTHENTICATION_REQUIRED<br />
                        {">"} CONNECT_WALLET_TO_INITIATE_SELL
                    </p>
                    <div className="w-full">
                        <WalletConnect />
                    </div>
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
                    [BACK_TO_ROOT]
                </Link>
                <div className="text-center">
                    <h1 className="text-lg font-bold uppercase text-brand">OFFLOAD_USDC</h1>
                    <p className="text-[10px] text-text-secondary uppercase">PROTOCOL: SELL_ORDER</p>
                </div>
                <div className="w-8"></div>
            </div>

            {/* Step: Enter Amount */}
            {step === "amount" && (
                <>
                    {/* Balance Display */}
                    <div className="bg-black border border-border p-3 mb-6 flex justify-between items-center font-mono">
                        <span className="text-[10px] text-text-secondary uppercase">AVAILABLE_BALANCE</span>
                        <span className="text-sm font-bold text-white">${parseFloat(balanceFormatted).toFixed(2)} USDC</span>
                    </div>

                    {/* Amount Display */}
                    <div className="bg-black border border-brand/50 p-6 mb-6 relative overflow-hidden group font-mono">
                        <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-[10px] uppercase text-brand">INPUT_STREAM</span>
                        </div>

                        <p className="text-[10px] text-brand uppercase mb-2">
                            {">"} ENTER_SELL_AMOUNT (USDC):
                        </p>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-gray-500">$</span>
                            <span className="text-4xl font-bold tracking-tight text-white animate-pulse-slow">
                                {amount === "0" ? "_" : amount}
                            </span>
                        </div>
                        <div className="border-t border-dashed border-border pt-2 mt-2">
                            <p className="text-xs text-text-secondary uppercase">
                                ESTIMATED_RECEIVE: {formatCurrency(fiatAmount, "INR")}
                            </p>
                        </div>
                    </div>

                    {/* Warnings */}
                    {!hasEnoughBalance && amount !== "0" && (
                        <div className="bg-error/10 border border-error/50 p-3 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-error" />
                            <span className="text-xs font-bold text-error uppercase">ERROR: INSUFFICIENT_FUNDS</span>
                        </div>
                    )}

                    {/* Limit Warning */}
                    {orderExceedsLimit && fiatAmount > 0 && (
                        <div className="bg-warning/10 border border-warning p-3 mb-4 font-mono">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs text-warning font-bold uppercase">ORDER_LIMIT_EXCEEDED</p>
                                    <p className="text-[10px] text-text-secondary mt-1">
                                        {">"}  Max per order: ${maxOrderUsdc} USDC
                                        {isLP ? ` (your stake)` : ' (user limit)'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Numpad */}
                    <div className="border-t border-brand/20 pt-6">
                        <Numpad value={amount} onChange={setAmount} />
                    </div>

                    {/* Continue Button */}
                    <button
                        onClick={handleContinue}
                        disabled={amount === "0" || parseFloat(amount) <= 0 || !hasEnoughBalance || orderExceedsLimit}
                        className="w-full mt-6 py-4 bg-brand text-black font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover transition-colors font-mono relative overflow-hidden"
                    >
                        <span className="relative z-10">{">"} PROCEED_TO_DETAILS</span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />
                    </button>
                    <p className="text-[10px] text-text-secondary text-center mt-2 uppercase font-mono">
                        {parseFloat(amount) > 0 && parseFloat(amount) < 10 ? 'SMALL ORDER FEE: $0.125 | ' : ''}MAX: ${maxOrderUsdc} USDC
                    </p>
                </>
            )}

            {/* Step: Payment Details */}
            {step === "payment" && (
                <div className="font-mono">
                    <div className="bg-surface/20 border border-border p-4 mb-6">
                        <div className="flex justify-between mb-2">
                            <span className="text-[10px] text-text-secondary uppercase">SELLING</span>
                            <span className="font-bold text-white">${amount} USDC</span>
                        </div>
                        <div className="flex justify-between border-t border-border border-dashed pt-2">
                            <span className="text-[10px] text-text-secondary uppercase">RECEIVING</span>
                            <span className="font-bold text-brand">{formatCurrency(fiatAmount, "INR")}</span>
                        </div>
                    </div>

                    {/* Payment Method - UPI Only */}
                    <div className="mb-6">
                        <label className="text-[10px] text-brand uppercase block mb-2 font-bold">
                            PAYMENT_METHOD
                        </label>
                        <div className="py-3 px-4 bg-brand/10 border border-brand text-brand font-bold uppercase text-xs">
                            UPI
                        </div>
                    </div>

                    {/* Payment Details Input */}
                    <div className="mb-6">
                        <label className="text-[10px] text-brand uppercase block mb-2 font-bold">
                            {">"} ENTER_UPI_ID
                        </label>
                        <input
                            type="text"
                            value={paymentDetails}
                            onChange={(e) => setPaymentDetails(e.target.value)}
                            placeholder="yourname@upi"
                            className="w-full bg-black border border-border p-4 text-white font-mono focus:border-brand outline-none placeholder:text-gray-800 text-sm"
                        />
                        <p className="text-[10px] text-text-secondary mt-1 uppercase opacity-70">
                            Ensure VPA is valid and receiving payments
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep("amount")}
                            className="flex-1 py-4 bg-transparent border border-border text-text-secondary font-bold uppercase text-xs hover:text-white hover:border-white transition-colors"
                        >
                            {"<< BACK"}
                        </button>
                        <button
                            onClick={handleCreateOrder}
                            disabled={!paymentDetails || isLoading}
                            className="flex-1 py-4 bg-brand text-black font-bold uppercase tracking-wider text-xs hover:bg-brand-hover transition-colors disabled:opacity-50"
                        >
                            {isLoading ? "BROADCASTING..." : "CREATE_OFFER"}
                        </button>
                    </div>
                </div>
            )}

            {/* Step: Waiting for Solver */}
            {step === "waiting" && currentOrder && (
                <div className="font-mono text-center pt-8">
                    <div className="bg-black border border-brand p-6 mb-6 relative overflow-hidden">
                        {currentOrder.status === "created" ? (
                            <>
                                <div className="absolute top-0 w-full h-1 bg-brand animate-scanline opacity-50"></div>
                                <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4 opacity-50"></div>
                                <h2 className="text-lg font-bold mb-2 uppercase text-white">SEARCHING_FOR_BUYERS</h2>
                                <p className="text-xs text-text-secondary uppercase animate-pulse">
                                    {">"} ORDER_BROADCAST_ACTIVE<br />
                                    {">"} WAITING_FOR_PEER_ACCEPTANCE
                                </p>
                            </>
                        ) : currentOrder.status === "matched" ? (
                            <>
                                <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                                <h2 className="text-lg font-bold text-success mb-2 uppercase">BUYER_LOCATED</h2>
                                <p className="text-xs text-text-secondary uppercase">
                                    {">"} PEER_PREPARING_PAYMENT<br />
                                    {">"} STANDBY_FOR_CONFIRMATION
                                </p>
                            </>
                        ) : currentOrder.status === "payment_sent" ? (
                            <>
                                <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-success">
                                    <CheckCircle className="w-8 h-8 text-success" />
                                </div>
                                <h2 className="text-lg font-bold text-success mb-2 uppercase">PAYMENT_REPORTED</h2>
                                <p className="text-xs text-text-secondary uppercase mb-4">
                                    {">"} BUYER_MARKED_AS_PAID<br />
                                    {">"} VERIFY_CREDIT_IN_BANK
                                </p>
                                <div className="p-2 border border-brand/50 bg-brand/5 inline-block text-[10px] text-brand uppercase">
                                    ACTION_REQUIRED: CONFIRM_RECEIPT
                                </div>
                            </>
                        ) : null}
                    </div>

                    {/* Order Details */}
                    <div className="bg-surface/20 border border-border p-4 mb-6 space-y-2 text-left">
                        <div className="flex justify-between">
                            <span className="text-[10px] text-text-secondary uppercase">AMOUNT</span>
                            <span className="font-bold text-white">{formatCurrency(currentOrder.amountFiat, currentOrder.fiatCurrency)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[10px] text-text-secondary uppercase">NETWORK_FEE</span>
                            <span className="font-mono text-xs text-brand">0.00 USDC</span>
                        </div>
                        <div className="flex justify-between border-t border-border border-dashed pt-2 mt-2">
                            <span className="text-[10px] text-text-secondary uppercase">STATUS</span>
                            <span className={`text-[10px] uppercase font-bold ${currentOrder.status === "created" ? "text-warning"
                                : currentOrder.status === "matched" ? "text-brand"
                                    : "text-success"
                                }`}>
                                {currentOrder.status.replace("_", " ")}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    {currentOrder.status === "payment_sent" ? (
                        <button
                            onClick={handleConfirmPayment}
                            className="w-full py-4 bg-success text-black font-bold uppercase tracking-wider text-sm hover:bg-green-500 transition-colors"
                        >
                            [ I_CONFIRM_PAYMENT_RECEIVED ]
                        </button>
                    ) : (
                        <button
                            onClick={handleCancelOrder}
                            disabled={currentOrder.status !== "created"}
                            className="w-full py-4 border border-error text-error font-bold uppercase tracking-wider text-xs hover:bg-error/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            CANCEL_OFFER
                        </button>
                    )}
                </div>
            )}

            {/* Step: Completed */}
            {step === "confirm" && (
                <div className="text-center font-mono pt-12">
                    <div className="w-24 h-24 border-2 border-success bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                        <CheckCircle className="w-10 h-10 text-success" />
                    </div>

                    <h2 className="text-2xl font-bold text-success mb-2 uppercase">OFFLOAD_COMPLETE</h2>
                    <p className="text-xs text-text-secondary mb-6 uppercase">
                        {">"} ASSET_TRANSFER_FINALIZED<br />
                        {">"} FIAT_CREDITED_TO_ACCOUNT
                    </p>

                    <div className="bg-black border border-border p-4 mb-8 text-left">
                        <div className="flex justify-between">
                            <span className="text-[10px] text-text-secondary uppercase">SOLD</span>
                            <span className="font-bold text-white">${amount} USDC</span>
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-[10px] text-text-secondary uppercase">RECEIVED</span>
                            <span className="font-bold text-success">{formatCurrency(fiatAmount, "INR")}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-4 bg-brand text-black font-bold uppercase tracking-wider hover:bg-brand-hover transition-colors"
                    >
                        [ RETURN_TO_ROOT ]
                    </button>
                </div>
            )}
        </div>
    )
}
