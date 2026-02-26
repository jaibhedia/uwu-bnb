"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Clock, CheckCircle, Loader2, ArrowDownLeft, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Numpad } from "@/components/app/numpad"
import { ThemeToggle } from "@/components/theme-toggle"
import { WalletConnect } from "@/components/app/wallet-connect"
import { useWallet } from "@/hooks/useWallet"
import { useStaking } from "@/hooks/useStaking"
import { USER_MAX_ORDER_USDC } from "@/hooks/useUserLimits"
import { fiatToUsdc, formatCurrency } from "@/lib/currency-converter"
import { useRouter } from "next/navigation"

/**
 * Buy Page - On-ramp Flow
 * 
 * User Flow:
 * 1. Enter fiat amount (INR)
 * 2. See USDC estimate
 * 3. Get payment details
 * 4. Pay via UPI/Bank
 * 5. Confirm payment
 * 6. USDC credited to wallet
 */

// Demo payment details for the platform
const PLATFORM_PAYMENT_DETAILS = {
    upi: "uwu@ybl",
    name: "uWu P2P",
    bankName: "HDFC Bank",
    accountNumber: "XXXX XXXX 1234",
}

export default function BuyPage() {
    const router = useRouter()
    const [amount, setAmount] = useState("0")
    const [step, setStep] = useState<"amount" | "payment" | "processing" | "success">("amount")
    const [orderId, setOrderId] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [countdown, setCountdown] = useState(15 * 60) // 15 minutes in seconds

    const { address, isConnected } = useWallet()
    const { stakeProfile, fetchStakeProfile } = useStaking()
    const [liveRate, setLiveRate] = useState<number | null>(null)

    // Fetch live rate on mount
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

    // Limit check: users = $150 USDC, LPs = staked USDC
    const isLP = stakeProfile?.isLP && stakeProfile.baseStake > 0
    const maxOrderUsdc = isLP ? stakeProfile!.baseStake : USER_MAX_ORDER_USDC
    const usdcAmount = amount !== "0" ? fiatToUsdc(parseFloat(amount), "INR") : 0
    const fiatAmount = parseFloat(amount) || 0
    const orderExceedsLimit = usdcAmount > maxOrderUsdc

    useEffect(() => {
        setMounted(true)
    }, [])

    // Countdown timer for payment
    useEffect(() => {
        if (step !== "payment") return

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 0) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [step])

    const formattedCountdown = `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, "0")}`

    const handleContinue = () => {
        if (amount === "0" || parseFloat(amount) <= 0) return

        // Check limit
        if (orderExceedsLimit) {
            return // Show limit warning in UI
        }

        // Generate order ID
        setOrderId(`BUY_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
        setStep("payment")
    }

    const handleConfirmPayment = async () => {
        setStep("processing")

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 2000))

        setStep("success")
    }

    if (!mounted) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-background">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-surface rounded w-32"></div>
                    <div className="h-40 bg-surface rounded"></div>
                </div>
            </div>
        )
    }

    if (!isConnected) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-background">
                <div className="flex items-center justify-between mb-8">
                    <Link href="/dashboard" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back</span>
                    </Link>
                    <ThemeToggle />
                </div>
                <div className="bg-surface border border-border p-6 text-center">
                    <ArrowDownLeft className="w-12 h-12 text-brand mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-text-primary mb-2">Connect Wallet to Buy</h2>
                    <p className="text-sm text-text-secondary mb-4">
                        Convert INR to USDC in your wallet
                    </p>
                    <WalletConnect />
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
                    <h1 className="text-lg font-bold uppercase text-brand">EXEC_BUY_ORDER</h1>
                    <p className="text-[10px] text-text-secondary uppercase">PROTOCOL: ON_RAMP_V2</p>
                </div>
                <div className="w-8"></div> {/* Spacer */}
            </div>

            {/* Step: Enter Amount */}
            {step === "amount" && (
                <>
                    {/* Terminal Input Display */}
                    <div className="bg-black border border-brand/50 p-6 mb-4 font-mono relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-40 transition-opacity">
                            <span className="text-[10px] uppercase text-brand">INPUT_STREAM</span>
                        </div>

                        <p className="text-brand text-xs mb-2">{">"} ENTER_FIAT_AMOUNT (INR):</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-gray-500">₹</span>
                            <span className="text-4xl font-bold tracking-tight text-white animate-pulse-slow">
                                {amount === "0" ? "_" : amount}
                            </span>
                        </div>
                    </div>

                    {/* Conversion Data Table */}
                    <div className="border border-border bg-surface/50 mb-6 text-xs font-mono">
                        <div className="flex justify-between p-2 border-b border-border bg-surface text-text-secondary">
                            <span>METRIC</span>
                            <span>VALUE</span>
                        </div>
                        <div className="p-2 flex justify-between border-b border-border/50">
                            <span className="text-text-secondary">EXCHANGE_RATE</span>
                            <span>1 USDC = ₹{liveRate?.toFixed(2) || '...'} <span className="text-green-400 text-[10px]">(live)</span></span>
                        </div>
                        <div className="p-2 flex justify-between bg-brand/5">
                            <span className="text-brand font-bold">OUTPUT_ESTIMATE</span>
                            <span className="text-brand font-bold">{usdcAmount.toFixed(2)} USDC</span>
                        </div>
                    </div>

                    {/* Numpad (Restyled) */}
                    <div className="border-t border-brand/20 pt-6">
                        <Numpad value={amount} onChange={setAmount} />
                    </div>

                    {/* Limit Warning */}
                    {orderExceedsLimit && parseFloat(amount) > 0 && (
                        <div className="mt-4 bg-warning/10 border border-warning p-3 font-mono">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs text-warning font-bold uppercase">ORDER_LIMIT_EXCEEDED</p>
                                    <p className="text-[10px] text-text-secondary mt-1">
                                        {">"}  Max per order: ${maxOrderUsdc} USDC
                                        {isLP ? ` (your stake: $${stakeProfile!.baseStake} USDC)` : ' (user limit)'}<br />
                                        {">"}  {isLP ? <Link href="/stake" className="text-brand underline">INCREASE_STAKE</Link> : 'Become an LP to increase your limit'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Execute Button */}
                    <button
                        onClick={handleContinue}
                        disabled={amount === "0" || parseFloat(amount) <= 0 || orderExceedsLimit}
                        className="w-full mt-6 py-4 bg-brand text-black font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover transition-colors font-mono relative overflow-hidden"
                    >
                        <span className="relative z-10">{">"} EXECUTE_ORDER</span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />
                    </button>
                    <p className="text-[10px] text-text-secondary text-center mt-2 uppercase font-mono">
                        {usdcAmount > 0 && usdcAmount < 10 ? 'SMALL ORDER FEE: $0.125 | ' : ''}MAX: ${maxOrderUsdc} USDC
                    </p>
                </>
            )}

            {/* Step: Payment Terminal */}
            {step === "payment" && orderId && (
                <div className="font-mono text-xs">
                    <div className="bg-warning/10 border border-warning text-warning p-4 mb-6 flex items-start gap-3">
                        <Clock className="w-5 h-5 animate-pulse" />
                        <div>
                            <p className="font-bold uppercase mb-1">SESSION_TIMEOUT_WARNING</p>
                            <p>TRANSACTION_EXPIRES_IN: {formattedCountdown}</p>
                        </div>
                    </div>

                    <div className="border border-border bg-black p-4 mb-4 relative">
                        <div className="absolute top-0 left-0 bg-surface border-b border-r border-border px-2 py-1 text-[10px] text-text-secondary uppercase">
                            PAYMENT_GATEWAY_DETAILS
                        </div>
                        <div className="mt-6 space-y-4">
                            <div>
                                <p className="text-text-secondary mb-1">BENEFICIARY_NAME</p>
                                <p className="text-lg font-bold">{PLATFORM_PAYMENT_DETAILS.name}</p>
                            </div>
                            <div>
                                <p className="text-text-secondary mb-1">VPA_ADDRESS</p>
                                <div className="bg-surface p-2 border border-border flex justify-between items-center">
                                    <code className="text-brand">{PLATFORM_PAYMENT_DETAILS.upi}</code>
                                    <span className="text-[10px] text-brand border border-brand px-1">[COPY]</span>
                                </div>
                            </div>

                            <div className="h-px bg-border border-dashed my-2" />

                            <div className="flex justify-between">
                                <span className="text-text-secondary">TOTAL_PAYABLE</span>
                                <span className="font-bold">{formatCurrency(parseFloat(amount), "INR")}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">REF_ID</span>
                                <span className="font-bold text-text-muted">{orderId?.slice(0, 12)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="border border-border bg-surface/20 p-4 mb-6">
                        <p className="font-bold uppercase mb-2 text-brand">INSTRUCTION_SET:</p>
                        <ol className="space-y-2 list-decimal list-inside text-text-secondary">
                            <li>INITIATE_UPI_TRANSFER</li>
                            <li>DESTINATION: <span className="text-white">{PLATFORM_PAYMENT_DETAILS.upi}</span></li>
                            <li>AMOUNT: <span className="text-white">{formatCurrency(parseFloat(amount), "INR")}</span></li>
                            <li>ADD_NOTE: "{orderId?.slice(0, 12)}"</li>
                        </ol>
                    </div>

                    <button
                        onClick={handleConfirmPayment}
                        className="w-full py-4 bg-brand text-black font-bold uppercase tracking-wider hover:bg-brand-hover transition-colors mb-2"
                    >
                        [ CONFIRM_PAYMENT_SENT ]
                    </button>
                    <button
                        onClick={() => setStep("amount")}
                        className="w-full py-3 bg-transparent border border-danger text-danger font-bold uppercase text-xs hover:bg-danger/10 transition-colors"
                    >
                        ABORT_TRANSACTION
                    </button>
                </div>
            )}

            {/* Step: Processing Terminal */}
            {step === "processing" && (
                <div className="text-center py-12 font-mono">
                    <Loader2 className="w-16 h-16 text-brand mx-auto mb-6 animate-spin" />
                    <h2 className="text-xl font-bold mb-2 animate-pulse">VERIFYING_BLOCKS...</h2>
                    <p className="text-xs text-text-secondary uppercase animate-pulse">
                        {">"} CHECKING_LEDGER<br />
                        {">"} VALIDATING_HASH<br />
                        {">"} SYNCING_NODE
                    </p>
                </div>
            )}

            {/* Step: Success Terminal */}
            {step === "success" && (
                <div className="text-center font-mono">
                    <div className="w-20 h-20 border-2 border-success rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                        <CheckCircle className="w-10 h-10 text-success" />
                    </div>
                    <h2 className="text-xl font-bold text-success mb-2 uppercase">TRANSACTION_CONFIRMED</h2>
                    <p className="text-text-secondary mb-6 text-xs uppercase">BLOCK_HEIGHT: 13948291</p>

                    <div className="border border-success/30 bg-success/5 p-4 mb-6 text-left">
                        <div className="flex justify-between mb-2 border-b border-success/20 pb-2">
                            <span className="text-text-secondary text-xs">DEBITED</span>
                            <span className="font-bold">{formatCurrency(parseFloat(amount), "INR")}</span>
                        </div>
                        <div className="flex justify-between pt-2">
                            <span className="text-text-secondary text-xs">CREDITED</span>
                            <span className="font-bold text-success">{usdcAmount.toFixed(2)} USDC</span>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-4 bg-transparent border border-brand text-brand font-bold uppercase tracking-wider hover:bg-brand hover:text-black transition-colors"
                    >
                        {">"} RETURN_TO_ROOT
                    </button>
                </div>
            )}
        </div>
    )
}
