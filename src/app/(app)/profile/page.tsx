"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ChevronLeft, User, Shield, TrendingUp, Award, Clock,
    CheckCircle, XCircle, AlertTriangle, Copy, ExternalLink,
    Star, Coins, History, AtSign, Loader2, Check, LogOut, Wallet
} from "lucide-react"
import { useWallet } from "@/hooks/useWallet"
import { useStaking, TIER_CONFIG, type Tier } from "@/hooks/useStaking"
import { useTrustScore } from "@/hooks/useTrustScore"
import { useUserLimits } from "@/hooks/useUserLimits"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { WalletConnect } from "@/components/app/wallet-connect"

/**
 * User/LP Profile Page
 * 
 * Shows:
 * - Reputation Score
 * - Tier and staking info
 * - Trade history summary
 * - LP status and earnings
 */

export default function ProfilePage() {
    const router = useRouter()
    const { isConnected, address, balance, displayName, disconnect } = useWallet()
    const { stakeProfile, isLoading: stakeLoading, fetchStakeProfile, getTierConfig } = useStaking()
    const { trustData, isLoading: trustLoading } = useTrustScore()
    const { limitData, isLoading: limitsLoading } = useUserLimits(address || null)
    const [mounted, setMounted] = useState(false)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (address) {
            fetchStakeProfile()
        }
    }, [address, fetchStakeProfile])

    // Display name = short address
    const resolvedDisplayName = displayName || 'Anonymous'

    const handleCopyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleDisconnect = async () => {
        await disconnect()
        router.push('/')
    }

    const getTierColor = (tier: Tier) => {
        const colors: Record<Tier, string> = {
            Starter: 'bg-gray-500',
            Bronze: 'bg-orange-500',
            Silver: 'bg-slate-400',
            Gold: 'bg-yellow-500',
            Diamond: 'bg-blue-500'
        }
        return colors[tier]
    }

    const getTierGradient = (tier: Tier) => {
        const gradients: Record<Tier, string> = {
            Starter: 'from-gray-500 to-gray-700',
            Bronze: 'from-orange-400 to-orange-600',
            Silver: 'from-slate-300 to-slate-500',
            Gold: 'from-yellow-400 to-yellow-600',
            Diamond: 'from-blue-400 to-blue-600'
        }
        return gradients[tier]
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-400'
        if (score >= 70) return 'text-yellow-400'
        if (score >= 50) return 'text-orange-400'
        return 'text-red-400'
    }

    const getScoreGradient = (score: number) => {
        if (score >= 90) return 'from-green-500 to-emerald-500'
        if (score >= 70) return 'from-yellow-500 to-orange-500'
        if (score >= 50) return 'from-orange-500 to-red-500'
        return 'from-red-500 to-red-700'
    }

    if (!mounted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full" />
            </div>
        )
    }

    if (!isConnected) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-background">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="text-text-secondary hover:text-text-primary">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-text-primary">Profile</h1>
                </div>

                <div className="bg-surface border border-border p-6 text-center">
                    <User className="w-16 h-16 text-brand mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-text-primary mb-2">Connect to View Profile</h2>
                    <p className="text-sm text-text-secondary mb-6">
                        Connect your wallet to view your reputation and trading history
                    </p>
                    <WalletConnect />
                </div>
            </div>
        )
    }

    // Calculate tier directly from stake amount (50 = Bronze, 200 = Silver, etc.)
    const calculateTierFromStake = (stakeAmount: number): typeof TIER_CONFIG[number]['name'] => {
        for (let i = TIER_CONFIG.length - 1; i >= 0; i--) {
            if (stakeAmount >= TIER_CONFIG[i].stakeRequired) {
                return TIER_CONFIG[i].name
            }
        }
        return 'Starter'
    }

    // Use recalculated tier to handle any stale hook data
    const currentTier = stakeProfile?.baseStake
        ? calculateTierFromStake(stakeProfile.baseStake)
        : (stakeProfile?.tier || 'Starter')

    // Calculate a meaningful trust score from available data
    const calculateTrustScore = () => {
        // Only use contract data if user has actual trades
        // This prevents showing stale/default contract values
        if (trustData?.score && trustData.score > 0 && trustData.completedTrades > 0) {
            return trustData.score
        }

        // Calculate from stake profile - start at 0 for new users
        let score = 0

        if (stakeProfile) {
            // +15 for being an LP with stake
            if (stakeProfile.isLP && stakeProfile.baseStake > 0) score += 15

            // +5 for each completed trade (max +30)
            const tradeBonus = Math.min(stakeProfile.completedTrades * 5, 30)
            score += tradeBonus

            // Penalty for disputes lost (-10 each, max -30)
            const disputePenalty = Math.min(stakeProfile.disputesLost * 10, 30)
            score -= disputePenalty

            // +5 for each tier above Starter (max +20)
            const tierIndex = ['Starter', 'Bronze', 'Silver', 'Gold', 'Diamond'].indexOf(stakeProfile.tier)
            const tierBonus = tierIndex * 5
            score += Math.min(tierBonus, 20)

            // +5 for account age > 7 days, +10 for > 30 days
            if (stakeProfile.memberSince > 0) {
                const ageInDays = (Date.now() - stakeProfile.memberSince) / (24 * 60 * 60 * 1000)
                if (ageInDays > 30) score += 10
                else if (ageInDays > 7) score += 5
            }
        }

        // Ensure score stays in 0-100 range
        return Math.max(0, Math.min(100, score))
    }

    const trustScore = calculateTrustScore()

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-border pb-4 border-dashed">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-text-secondary hover:text-brand">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold uppercase text-brand">USER_PROFILE</h1>
                        <p className="text-[10px] text-text-secondary uppercase">IDENTITY_MODULE_V2</p>
                    </div>
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-surface border border-border p-6 mb-6">
                {/* Avatar and Name */}
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getTierGradient(currentTier)} flex items-center justify-center`}>
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                        <div className="text-xl font-bold text-text-primary">{resolvedDisplayName}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-text-secondary font-mono">
                                {address?.slice(0, 6)}...{address?.slice(-4)}
                            </span>
                            <button onClick={handleCopyAddress} className="text-text-secondary hover:text-brand">
                                {copied ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                    <Badge className={`${getTierColor(currentTier)} text-white`}>
                        {currentTier}
                    </Badge>
                </div>

                {/* Balance */}
                <div className="bg-background/50 rounded-sm p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs text-text-secondary uppercase mb-1">Wallet Balance</div>
                            <div className="text-2xl font-bold text-text-primary">{balance.toFixed(2)} USDC</div>
                        </div>
                        <Coins className="w-8 h-8 text-brand" />
                    </div>
                </div>

                {/* LP Status */}
                {stakeProfile?.isLP && (
                    <div className="bg-green-500/10 border border-green-500/20 p-3 flex items-center gap-3">
                        <Shield className="w-5 h-5 text-green-500" />
                        <div className="flex-1">
                            <div className="text-sm font-medium text-green-400">Active LP</div>
                            <div className="text-xs text-green-500/70">Providing liquidity and earning rewards</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Limits */}
            <div className="bg-surface border border-border p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-brand" />
                    <h2 className="font-bold text-text-primary uppercase">Current Limits</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-background/50 rounded-sm p-3">
                        <div className="text-xs text-text-secondary uppercase mb-1">Max Order</div>
                        <div className="text-lg font-bold text-text-primary">
                            ${stakeProfile ? getTierConfig(stakeProfile.tier).maxOrder : 150} USDC
                        </div>
                    </div>
                    <div className="bg-background/50 rounded-sm p-3">
                        <div className="text-xs text-text-secondary uppercase mb-1">Completed</div>
                        <div className="text-lg font-bold text-text-primary">
                            {stakeProfile?.completedTrades || 0} trades
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm py-2">
                    <span className="text-text-secondary">Account Age</span>
                    <span className="text-text-primary font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-text-secondary" />
                        {stakeProfile?.memberSince
                            ? `${Math.floor((Date.now() - stakeProfile.memberSince) / (1000 * 60 * 60 * 24))} days`
                            : 'New'
                        }
                    </span>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <Link
                    href="/orders"
                    className="bg-surface border border-border p-4 text-center hover:border-brand/50 transition-colors"
                >
                    <History className="w-6 h-6 text-brand mx-auto mb-2" />
                    <div className="text-sm font-medium text-text-primary">Order History</div>
                </Link>
                <Link
                    href="/dao"
                    className="bg-surface border border-border p-4 text-center hover:border-brand/50 transition-colors"
                >
                    <Award className="w-6 h-6 text-brand mx-auto mb-2" />
                    <div className="text-sm font-medium text-text-primary">Validate</div>
                </Link>
                <Link
                    href="/contracts"
                    className="col-span-2 bg-surface border border-border p-4 text-center hover:border-brand/50 transition-colors flex items-center justify-center gap-2"
                >
                    <Wallet className="w-5 h-5 text-brand" />
                    <div className="text-sm font-medium text-text-primary">Contracts & Fee collector</div>
                </Link>
            </div>

            {/* Logout Button */}
            <button
                onClick={handleDisconnect}
                className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-400 font-medium flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
            >
                <LogOut className="w-5 h-5" />
                Disconnect Wallet
            </button>
        </div>
    )
}
