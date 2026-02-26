"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Wallet, ArrowRight, Check, Coins, Shield, Loader2, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { useWallet } from "@/hooks/useWallet"
import { WalletConnect } from "@/components/app/wallet-connect"

/**
 * Onboarding Page — Simplified, no framer-motion
 * 
 * This page only shows when users manually navigate to /onboarding.
 * It is NOT forced on any user — wallet connection auto-marks onboarding
 * complete in wallet-context.tsx.
 * 
 * Steps:
 * 1. Connect wallet (social login)
 * 2. Load wallet with USDC on BNB
 * 3. Ready to transact
 */

const STEPS = [
    {
        id: 1,
        title: "Connect Wallet",
        description: "Sign in with Google, Apple, or Email",
        icon: Wallet
    },
    {
        id: 2,
        title: "Load USDC",
        description: "Deposit USDC to your BNB wallet",
        icon: Coins
    },
    {
        id: 3,
        title: "Start Trading",
        description: "You're ready to buy, sell, or provide liquidity",
        icon: Shield
    }
]

export default function OnboardingPage() {
    const router = useRouter()
    const { isConnected, address, balance, isLoading, displayName } = useWallet()
    const [mounted, setMounted] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const [depositAmount, setDepositAmount] = useState("")

    useEffect(() => {
        setMounted(true)
    }, [])

    // If already connected, skip straight to dashboard
    useEffect(() => {
        if (mounted && isConnected && !isLoading) {
            router.replace('/dashboard')
        }
    }, [mounted, isConnected, isLoading, router])

    // Auto-advance to step 2 when connected
    useEffect(() => {
        if (isConnected && currentStep === 1) {
            setCurrentStep(2)
        }
    }, [isConnected, currentStep])

    const handleDeposit = () => {
        if (!address) return
        const amount = parseFloat(depositAmount)
        if (isNaN(amount) || amount <= 0) return
        alert(`Send ${amount} USDC to your wallet:\n${address}`)
        setCurrentStep(3)
    }

    const handleGoToDashboard = () => {
        router.push("/dashboard")
    }

    if (!mounted) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-green-500" />
            </div>
        )
    }

    if (isLoading && !isConnected) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                <p className="text-gray-500 text-xs">Reconnecting...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#1a1a2e_0%,_#000000_70%)] opacity-50" />

            {/* Back Link */}
            <div className="absolute top-4 left-4 z-20">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm">Back</span>
                </Link>
            </div>

            <div className="relative z-10 max-w-md mx-auto px-4 pt-14 pb-8 min-h-screen flex flex-col justify-center">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold mb-1">Get Started</h1>
                    <p className="text-gray-400 text-sm">Complete these steps to start trading</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {STEPS.map((step, index) => (
                        <div key={step.id} className="flex items-center">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${currentStep > step.id
                                        ? 'bg-green-500'
                                        : currentStep === step.id
                                            ? 'bg-green-500'
                                            : 'bg-white/10'
                                    }`}
                            >
                                {currentStep > step.id ? (
                                    <Check className="w-4 h-4 text-white" />
                                ) : (
                                    <span className={`text-xs font-bold ${currentStep === step.id ? 'text-white' : 'text-gray-500'}`}>
                                        {step.id}
                                    </span>
                                )}
                            </div>
                            {index < STEPS.length - 1 && (
                                <div className={`w-10 h-0.5 mx-1 ${currentStep > step.id ? 'bg-green-500' : 'bg-white/10'}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div>
                    {/* Step 1: Connect Wallet */}
                    {currentStep === 1 && (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <Wallet className="w-8 h-8 text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
                            <p className="text-gray-400 text-sm mb-8 px-4">
                                Sign in with your preferred method. We&apos;ll create a secure wallet for you on BNB chain.
                            </p>
                            <WalletConnect />
                        </div>
                    )}

                    {/* Step 2: Load USDC */}
                    {currentStep === 2 && (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                                <Coins className="w-8 h-8 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">Load Your Wallet</h2>
                            <p className="text-gray-400 text-sm mb-4 px-2">
                                Deposit USDC to start trading
                            </p>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                                <div className="text-xs text-gray-500 mb-1">Connected as</div>
                                <div className="text-sm font-bold text-white mb-1">{displayName || 'Loading...'}</div>
                                <div className="text-[10px] text-gray-500 font-mono break-all">{address}</div>

                                <div className="mt-3 pt-3 border-t border-white/10">
                                    <div className="text-xs text-gray-500 mb-1">Current Balance</div>
                                    <div className="text-xl font-bold text-white">{balance.toFixed(2)} USDC</div>
                                </div>
                            </div>

                            <div className="space-y-3 mt-4">
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        placeholder="Enter USDC amount"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                                        USDC
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {[50, 100, 200, 500].map((amt) => (
                                        <button
                                            key={amt}
                                            onClick={() => setDepositAmount(amt.toString())}
                                            className="flex-1 py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors"
                                        >
                                            ${amt}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={handleDeposit}
                                    disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    Deposit USDC
                                    <ArrowRight className="w-5 h-5" />
                                </button>

                                {balance > 0 && (
                                    <button
                                        onClick={() => setCurrentStep(3)}
                                        className="w-full py-3 text-gray-400 hover:text-white transition-colors text-sm"
                                    >
                                        Skip — I already have USDC
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Ready */}
                    {currentStep === 3 && (
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-400" />
                            </div>
                            <h2 className="text-xl font-bold mb-2">You&apos;re All Set!</h2>
                            <p className="text-gray-400 text-sm mb-4 px-2">
                                Your wallet is ready. Start trading or explore the platform.
                            </p>

                            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-500/20 rounded-xl p-4 mb-4">
                                <div className="text-xs text-gray-500 mb-1">Wallet Balance</div>
                                <div className="text-2xl font-bold text-white mb-2">{balance.toFixed(2)} USDC</div>
                                <div className="text-xs text-gray-400">
                                    {displayName} • BNB Chain
                                </div>
                            </div>

                            <div className="space-y-3 mt-4">
                                <button
                                    onClick={handleGoToDashboard}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold flex items-center justify-center gap-2"
                                >
                                    Go to Dashboard
                                    <ArrowRight className="w-5 h-5" />
                                </button>

                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => router.push("/buy")}
                                        className="py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors"
                                    >
                                        Buy USDC
                                    </button>
                                    <button
                                        onClick={() => router.push("/sell")}
                                        className="py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors"
                                    >
                                        Sell USDC
                                    </button>
                                    <button
                                        onClick={() => router.push("/lp/register")}
                                        className="py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-colors"
                                    >
                                        Be an LP
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
