"use client"

import { useState, useEffect, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Plus, ArrowDownLeft, Send, History, Wallet, Loader2, QrCode, Users, Scale, Shield, User, Receipt, ChevronRight, Activity } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { WalletConnect } from "@/components/app/wallet-connect"
import { BottomNav } from "@/components/app/bottom-nav"
import { TierProgress } from "@/components/app/tier-progress"
import { LiveRatePopup } from "@/components/app/live-rate-popup"
import { TutorialOverlay } from "@/components/app/tutorial-overlay"
import { fetchLiveRates } from "@/lib/currency-converter"
import { useWallet } from "@/hooks/useWallet"
import { useStaking } from "@/hooks/useStaking"

function DashboardContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { isConnected, address, balance, shortAddress, isLoading, isFirstTimeUser } = useWallet()
    const { stakeProfile, fetchStakeProfile } = useStaking()
    const [mounted, setMounted] = useState(false)
    const [showRatePopup, setShowRatePopup] = useState(false)
    const [liveRate, setLiveRate] = useState<number | null>(null)

    // Fetch live rate for the ticker display
    const loadRate = useCallback(async () => {
        try {
            const rates = await fetchLiveRates()
            setLiveRate(rates.INR)
        } catch (err) {
            console.error('Failed to fetch rate:', err)
        }
    }, [])

    useEffect(() => {
        loadRate()
        const interval = setInterval(loadRate, 60000) // refresh every 60s
        return () => clearInterval(interval)
    }, [loadRate])

    // Auto-open rate popup if ?showRate=true in URL
    useEffect(() => {
        if (searchParams.get('showRate') === 'true') {
            setShowRatePopup(true)
        }
    }, [searchParams])

    useEffect(() => {
        setMounted(true)
        if (address) {
            fetchStakeProfile()
        }
    }, [address, fetchStakeProfile])

    // Skip forced onboarding — just let users in
    // useEffect(() => {
    //     if (mounted && isConnected && isFirstTimeUser) {
    //         router.push('/onboarding')
    //     }
    // }, [mounted, isConnected, isFirstTimeUser, router])

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

    if (isLoading) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        )
    }

    if (!isConnected) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-background">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-xl font-bold text-text-primary">uWu</h1>
                    <ThemeToggle />
                </div>

                <div className="bg-surface border border-border p-6 text-center mb-6">
                    <Wallet className="w-16 h-16 text-brand mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-text-primary mb-2">Welcome to uWu</h2>
                    <p className="text-sm text-text-secondary mb-6">
                        Pay with USDC at any UPI QR. Create your wallet to get started.
                    </p>
                    <WalletConnect />
                </div>

                <div className="space-y-3">
                    <div className="bg-surface border border-border p-4">
                        <h3 className="font-bold text-text-primary mb-2">How it works</h3>
                        <ol className="text-sm text-text-secondary space-y-2 list-decimal list-inside">
                            <li>Create wallet & deposit USDC</li>
                            <li>Scan any UPI QR to create order</li>
                            <li>LP pays your QR, you get fiat</li>
                        </ol>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
            {/* Tutorial Overlay — shown once for new users */}
            <TutorialOverlay address={address ?? undefined} onClose={() => { }} />

            {/* Rate Popup */}
            <LiveRatePopup isOpen={showRatePopup} onClose={() => setShowRatePopup(false)} />

            {/* Header / System Status */}
            <div className="flex items-center justify-between mb-8 border-b border-border pb-4 border-dashed">
                <div>
                    <h1 className="text-xl font-bold uppercase tracking-wider text-brand">uWu_TERMINAL</h1>
                    <p className="text-xs text-text-secondary uppercase">v2.0.4 [TESTNET]</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* USDC/INR Rate Ticker */}
                    <button
                        onClick={() => setShowRatePopup(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-surface/50 hover:border-brand hover:bg-surface-hover transition-all group cursor-pointer"
                    >
                        <Activity className="w-3 h-3 text-brand" />
                        <span className="text-[10px] font-bold text-text-secondary group-hover:text-brand uppercase tracking-wider font-mono">USDC/INR</span>
                        {liveRate && (
                            <span className="text-[10px] font-bold text-brand font-mono">₹{liveRate.toFixed(2)}</span>
                        )}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                        <span className="text-xs font-bold text-success">ONLINE</span>
                    </div>
                </div>
            </div>

            {/* Account Info Block */}
            <div className="mb-8">
                <div className="flex items-center justify-between text-xs text-text-secondary mb-1 uppercase tracking-widest">
                    <span>Accountlink</span>
                    <span>{shortAddress}</span>
                </div>
                <div className="border border-border bg-surface/50 p-6 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-1 opacity-50">
                        <Wallet className="w-12 h-12 text-border -rotate-12 group-hover:text-brand/20 transition-colors" />
                    </div>

                    <p className="text-xs text-brand mb-2 uppercase flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-brand"></span>
                        Available_Balance
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold tracking-tight text-white">${balance.toFixed(2)}</span>
                        <span className="text-sm text-text-muted">USDC</span>
                    </div>


                </div>
            </div>

            {/* Tier Progress */}
            <div className="mb-8">
                <h3 className="text-xs text-text-secondary uppercase mb-3 px-1 border-l-2 border-brand pl-2">
                    Current_Limit
                </h3>
                <TierProgress compact showUpgradePrompt />
            </div>

            {/* Command Palette / Actions */}
            <div className="mb-8">
                <h3 className="text-xs text-text-secondary uppercase mb-3 px-1 border-l-2 border-brand pl-2">
                    Quick_Actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {!stakeProfile?.isLP && (
                        <Link
                            href="/scan"
                            className="flex flex-col gap-2 p-4 border border-border bg-card hover:border-brand hover:bg-surface-hover transition-all group"
                        >
                            <div className="flex justify-between items-start">
                                <QrCode className="w-5 h-5 text-text-secondary group-hover:text-brand transition-colors" />
                                <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">USER</span>
                            </div>
                            <div>
                                <span className="block text-sm font-bold group-hover:text-brand">SCAN & PAY</span>
                                <span className="text-[10px] text-text-secondary lowercase">{">>"} pay_via_upi</span>
                            </div>
                        </Link>
                    )}

                    <Link
                        href="/wallet"
                        className="flex flex-col gap-2 p-4 border border-border bg-card hover:border-success hover:bg-surface-hover transition-all group"
                    >
                        <div className="flex justify-between items-start">
                            <Wallet className="w-5 h-5 text-text-secondary group-hover:text-success transition-colors" />
                            <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">USER</span>
                        </div>
                        <div>
                            <span className="block text-sm font-bold group-hover:text-success">WALLET</span>
                            <span className="text-[10px] text-text-secondary lowercase">{">>"} manage_funds</span>
                        </div>
                    </Link>

                    <Link
                        href="/orders"
                        className="flex flex-col gap-2 p-4 border border-border bg-card hover:border-brand hover:bg-surface-hover transition-all group"
                    >
                        <div className="flex justify-between items-start">
                            <Receipt className="w-5 h-5 text-text-secondary group-hover:text-brand transition-colors" />
                            <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">USER</span>
                        </div>
                        <div>
                            <span className="block text-sm font-bold group-hover:text-brand">MY ORDERS</span>
                            <span className="text-[10px] text-text-secondary lowercase">{">>"} transaction_history</span>
                        </div>
                    </Link>

                    {/* DAO Validation - Only show for validators (>= 100 USDC) */}
                    {stakeProfile && stakeProfile.baseStake >= 100 && (
                        <Link
                            href="/dao"
                            className="flex flex-col gap-2 p-4 border border-border bg-card hover:border-green-500 hover:bg-surface-hover transition-all group"
                        >
                            <div className="flex justify-between items-start">
                                <Scale className="w-5 h-5 text-text-secondary group-hover:text-green-500 transition-colors" />
                                <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">DAO</span>
                            </div>
                            <div>
                                <span className="block text-sm font-bold group-hover:text-green-500">VALIDATE</span>
                                <span className="text-[10px] text-text-secondary lowercase">{">>"} review_payments</span>
                            </div>
                        </Link>
                    )}
                </div>
            </div>

            {/* More Options */}
            <div className="mb-8">
                <h3 className="text-xs text-text-secondary uppercase mb-3 px-1 border-l-2 border-brand pl-2">
                    More_Options
                </h3>
                <div className="border border-border bg-surface/50 divide-y divide-border">
                    <Link href="/lp/register" className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors group">
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-brand" />
                            <div>
                                <span className="block text-sm font-medium text-text-primary group-hover:text-brand">Tier Upgrade</span>
                                <span className="text-[10px] text-text-secondary">Increase limits & become LP</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                    </Link>

                    <Link href="/profile" className="flex items-center justify-between p-4 hover:bg-surface-hover transition-colors group">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-green-500" />
                            <div>
                                <span className="block text-sm font-medium text-text-primary group-hover:text-brand">Profile</span>
                                <span className="text-[10px] text-text-secondary">Reputation & account details</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                    </Link>

                </div>
            </div>

            {/* Recent Activity Log */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs text-text-secondary uppercase px-1 border-l-2 border-brand pl-2">Transactions</h3>
                    <Link href="/orders" className="text-[10px] text-brand hover:underline uppercase">[View_All]</Link>
                </div>

                <div className="border border-border bg-surface/50 text-xs font-mono">
                    <div className="border-b border-border bg-surface p-2 flex justify-between text-text-muted">
                        <span>TIMESTAMP</span>
                        <span>EVENT</span>
                        <span>STATUS</span>
                    </div>
                    {/* Empty State */}
                    <div className="p-8 text-center text-text-secondary">
                        <p className="mb-2">{">"} No recent transactions found in buffer.</p>
                        <p className="opacity-50 text-[10px]">Prepare to execute first order...</p>
                    </div>
                </div>
            </div>

        </div>
    )
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    )
}
