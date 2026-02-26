"use client"

import { useEffect } from "react"
import { Shield, TrendingUp, Clock, Star, AlertTriangle, CheckCircle } from "lucide-react"
import { useTrustScore, TRUST_TIER_CONFIG, type TrustTier } from "@/hooks/useTrustScore"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface TrustScoreCardProps {
    address?: string
    compact?: boolean
    showDetails?: boolean
}

/**
 * Trust Score Card Component
 * Displays on-chain trust score and reputation data
 */
export function TrustScoreCard({ address, compact = false, showDetails = true }: TrustScoreCardProps) {
    const { trustData, isLoading, fetchTrustScore, getScoreColor, getTierConfig } = useTrustScore(address)

    useEffect(() => {
        if (address) {
            fetchTrustScore()
        }
    }, [address, fetchTrustScore])

    const getTierGradient = (tier: TrustTier) => {
        const gradients: Record<TrustTier, string> = {
            'New': 'from-gray-500 to-gray-700',
            'Trusted': 'from-green-400 to-green-600',
            'Verified': 'from-blue-400 to-blue-600',
            'Expert': 'from-purple-400 to-purple-600',
            'Elite': 'from-yellow-400 to-yellow-600'
        }
        return gradients[tier]
    }

    const getTierBadgeVariant = (tier: TrustTier): "default" | "secondary" | "success" | "warning" => {
        switch (tier) {
            case 'Elite': return 'warning'
            case 'Expert': return 'default'
            case 'Verified': return 'default'
            case 'Trusted': return 'success'
            default: return 'secondary'
        }
    }

    if (isLoading) {
        return (
            <div className={`bg-surface border border-border rounded-lg ${compact ? 'p-3' : 'p-6'} animate-pulse`}>
                <div className="h-20 bg-muted rounded" />
            </div>
        )
    }

    if (!trustData) {
        return (
            <div className={`bg-surface border border-border rounded-lg ${compact ? 'p-3' : 'p-6'} text-center`}>
                <Shield className="w-8 h-8 text-text-secondary mx-auto mb-2" />
                <p className="text-sm text-text-secondary">No trust data available</p>
            </div>
        )
    }

    const tierConfig = getTierConfig(trustData.tier)

    // Compact version for inline displays
    if (compact) {
        return (
            <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getTierGradient(trustData.tier)} flex items-center justify-center`}>
                    <span className="text-white font-bold">{trustData.score}</span>
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <Badge variant={getTierBadgeVariant(trustData.tier)}>{trustData.tier}</Badge>
                        {trustData.isLP && <Badge variant="success">LP</Badge>}
                    </div>
                    <p className="text-xs text-text-secondary">
                        {trustData.completedTrades} trades • {100 - trustData.disputeRatio}% success
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
            {/* Header with score */}
            <div className={`p-6 bg-gradient-to-br ${getTierGradient(trustData.tier)} text-white`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm opacity-80 uppercase">Trust Score</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold">{trustData.score}</span>
                            <span className="text-sm opacity-80">/ 100</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <Badge variant="outline" className="bg-white/20 border-white/30 text-white">
                            {trustData.tier}
                        </Badge>
                        {trustData.isLP && (
                            <Badge variant="outline" className="ml-2 bg-white/20 border-white/30 text-white">
                                LP
                            </Badge>
                        )}
                    </div>
                </div>
                <p className="text-sm opacity-80 mt-2">{tierConfig.description}</p>
            </div>

            {showDetails && (
                <div className="p-6 space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
                                <TrendingUp className="w-4 h-4" />
                                Completed
                            </div>
                            <div className="text-xl font-bold font-mono">{trustData.completedTrades}</div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
                                <Star className="w-4 h-4" />
                                Success Rate
                            </div>
                            <div className="text-xl font-bold font-mono text-success">
                                {100 - trustData.disputeRatio}%
                            </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
                                <Clock className="w-4 h-4" />
                                Account Age
                            </div>
                            <div className="text-xl font-bold font-mono">
                                {trustData.accountAge} days
                            </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
                                <AlertTriangle className="w-4 h-4" />
                                Disputes
                            </div>
                            <div className="text-xl font-bold font-mono">
                                {trustData.disputes}
                                {trustData.disputesLost > 0 && (
                                    <span className="text-sm text-error ml-1">
                                        ({trustData.disputesLost} lost)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Volume */}
                    <div className="p-3 bg-muted rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-text-secondary">Total Volume</span>
                            <span className="font-mono font-bold">
                                ${trustData.totalVolume.toLocaleString()} USDC
                            </span>
                        </div>
                    </div>

                    {/* LP Stake if applicable */}
                    {trustData.isLP && trustData.lpStake > 0 && (
                        <div className="p-3 bg-brand/10 border border-brand/20 rounded-lg">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-brand" />
                                    <span className="text-sm font-bold text-brand">Active LP</span>
                                </div>
                                <span className="font-mono">
                                    {trustData.lpStake.toLocaleString()} USDC staked
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Tier Progress */}
                    <div className="space-y-2">
                        <p className="text-xs text-text-secondary uppercase">Tier Progression</p>
                        <div className="flex gap-1">
                            {Object.entries(TRUST_TIER_CONFIG).map(([tier, config]) => (
                                <div
                                    key={tier}
                                    className={`flex-1 h-2 rounded-full ${
                                        trustData.score >= config.minScore
                                            ? `bg-gradient-to-r ${getTierGradient(tier as TrustTier)}`
                                            : 'bg-muted'
                                    }`}
                                    title={`${tier}: ${config.minScore}+`}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-text-secondary">
                            <span>New</span>
                            <span>Elite</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Mini trust badge for inline use
 */
export function TrustBadge({ address, showScore = true }: { address?: string; showScore?: boolean }) {
    const { trustData } = useTrustScore(address)

    if (!trustData) {
        return <Badge variant="secondary">New</Badge>
    }

    const getTierBadgeVariant = (tier: TrustTier): "default" | "secondary" | "success" | "warning" => {
        switch (tier) {
            case 'Elite': return 'warning'
            case 'Expert': return 'default'
            case 'Verified': return 'default'
            case 'Trusted': return 'success'
            default: return 'secondary'
        }
    }

    return (
        <div className="flex items-center gap-1">
            <Badge variant={getTierBadgeVariant(trustData.tier)}>
                {trustData.tier}
            </Badge>
            {showScore && (
                <span className="text-xs text-text-secondary font-mono">
                    {trustData.score}
                </span>
            )}
        </div>
    )
}
