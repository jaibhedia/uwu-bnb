"use client"

import { Shield, ChevronRight, Lock } from "lucide-react"
import Link from "next/link"
import { useStaking, TIER_CONFIG, type Tier } from "@/hooks/useStaking"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

interface TierProgressProps {
    showUpgradePrompt?: boolean
    compact?: boolean
}

/**
 * Tier Progress Component
 * Shows current tier, order limits, and progress to next tier
 */
export function TierProgress({ showUpgradePrompt = true, compact = false }: TierProgressProps) {
    const { stakeProfile, getTierConfig } = useStaking()

    const currentTier = stakeProfile?.tier || 'Starter'
    const currentConfig = getTierConfig(currentTier)
    const nextTier = stakeProfile?.nextTier
    const progressToNext = stakeProfile?.progressToNextTier || 0

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

    const getTierTextColor = (tier: Tier) => {
        const colors: Record<Tier, string> = {
            Starter: 'text-gray-500',
            Bronze: 'text-orange-500',
            Silver: 'text-slate-400',
            Gold: 'text-yellow-500',
            Diamond: 'text-blue-500'
        }
        return colors[tier]
    }

    if (compact) {
        return (
            <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
                <div className={`w-10 h-10 rounded-full ${getTierColor(currentTier)} flex items-center justify-center`}>
                    <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold ${getTierTextColor(currentTier)}`}>
                            {currentTier}
                        </span>
                        <span className="text-xs text-text-secondary">
                            Max: ${currentConfig.maxOrder} USDC
                        </span>
                    </div>
                    {nextTier && (
                        <Progress 
                            value={progressToNext} 
                            className="h-1 mt-1"
                        />
                    )}
                </div>
                {showUpgradePrompt && nextTier && (
                    <Link href="/stake" className="text-brand">
                        <ChevronRight className="w-5 h-5" />
                    </Link>
                )}
            </div>
        )
    }

    return (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
            {/* Current Tier Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${getTierColor(currentTier)} flex items-center justify-center`}>
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg ${getTierTextColor(currentTier)}`}>
                            {currentTier} Tier
                        </h3>
                        <p className="text-sm text-text-secondary">
                            {stakeProfile?.baseStake.toFixed(2) || '0.00'} USDC staked
                        </p>
                    </div>
                </div>
                <Link href="/stake">
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                        Manage
                    </Badge>
                </Link>
            </div>

            {/* Order Limits */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-text-secondary mb-1">Max Order</p>
                    <p className="font-bold font-mono">
                        ${currentConfig.maxOrder} USDC
                    </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-text-secondary mb-1">Available Stake</p>
                    <p className="font-bold font-mono text-success">
                        {stakeProfile?.availableStake.toFixed(2) || '0.00'} USDC
                    </p>
                </div>
            </div>

            {/* Progress to Next Tier */}
            {nextTier && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Progress to {nextTier}</span>
                        <span className="font-mono">{progressToNext.toFixed(0)}%</span>
                    </div>
                    <Progress value={progressToNext} />
                    <p className="text-xs text-text-secondary">
                        Stake {(getTierConfig(nextTier).stakeRequired - (stakeProfile?.baseStake || 0)).toFixed(2)} more USDC to unlock {nextTier}
                    </p>
                </div>
            )}

            {/* Tier Benefits */}
            <div className="flex flex-wrap gap-1">
                {currentConfig.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                    </Badge>
                ))}
            </div>

            {/* Locked Stake Warning */}
            {(stakeProfile?.lockedStake || 0) > 0 && (
                <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/20 rounded-lg">
                    <Lock className="w-4 h-4 text-warning" />
                    <span className="text-xs text-warning">
                        {stakeProfile?.lockedStake.toFixed(2)} USDC locked in active orders
                    </span>
                </div>
            )}

            {/* Upgrade CTA */}
            {showUpgradePrompt && nextTier && (
                <Link 
                    href="/stake"
                    className="block w-full py-3 text-center bg-brand/10 text-brand rounded-lg font-bold hover:bg-brand/20 transition-colors"
                >
                    Upgrade to {nextTier}
                </Link>
            )}
        </div>
    )
}

/**
 * Inline tier indicator for headers
 */
export function TierIndicator({ tier }: { tier?: Tier }) {
    const displayTier = tier || 'Starter'
    
    const getTierColor = (t: Tier) => {
        const colors: Record<Tier, string> = {
            Starter: 'bg-gray-500',
            Bronze: 'bg-orange-500',
            Silver: 'bg-slate-400',
            Gold: 'bg-yellow-500',
            Diamond: 'bg-blue-500'
        }
        return colors[t]
    }

    return (
        <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${getTierColor(displayTier)}`} />
            <span className="text-xs font-mono uppercase">{displayTier}</span>
        </div>
    )
}

/**
 * Order limit check component
 */
export function OrderLimitCheck({ 
    amountUsdc, 
    onLimitExceeded 
}: { 
    amountUsdc: number
    onLimitExceeded?: () => void 
}) {
    const { stakeProfile, getTierConfig } = useStaking()
    
    const currentTier = stakeProfile?.tier || 'Starter'
    const currentConfig = getTierConfig(currentTier)
    const isOverLimit = amountUsdc > currentConfig.maxOrder

    if (!isOverLimit) return null

    return (
        <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
            <div className="flex items-start gap-2">
                <Lock className="w-5 h-5 text-error flex-shrink-0" />
                <div>
                    <p className="text-sm font-bold text-error">Order exceeds limit</p>
                    <p className="text-xs text-text-secondary mt-1">
                        Your {currentTier} tier limit is ${currentConfig.maxOrder} USDC.
                        {stakeProfile?.nextTier && (
                            <> Upgrade to {stakeProfile.nextTier} for higher limits.</>
                        )}
                    </p>
                    <Link 
                        href="/stake" 
                        className="text-xs text-brand font-bold mt-2 inline-block"
                        onClick={onLimitExceeded}
                    >
                        Increase Stake →
                    </Link>
                </div>
            </div>
        </div>
    )
}
