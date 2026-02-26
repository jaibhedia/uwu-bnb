"use client"

import { useFraudProfile, getRiskColor, getRiskLabel } from '@/hooks/useFraudProfile'
import { type RiskLevel } from '@/lib/platform-config'
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'

interface RiskIndicatorProps {
    address: string
    showDetails?: boolean
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

/**
 * Risk Indicator Component
 * Displays user's risk level with color-coded badge
 */
export function RiskIndicator({
    address,
    showDetails = false,
    size = 'md',
    className = '',
}: RiskIndicatorProps) {
    const { riskLevel, riskScore, requiredActions, isLoading } = useFraudProfile(address)

    const color = getRiskColor(riskLevel)
    const label = getRiskLabel(riskLevel)

    const sizeClasses = {
        sm: 'text-[10px] px-2 py-1',
        md: 'text-xs px-3 py-1.5',
        lg: 'text-sm px-4 py-2',
    }

    const iconSize = {
        sm: 12,
        md: 14,
        lg: 16,
    }

    const Icon = {
        low: ShieldCheck,
        medium: Shield,
        high: ShieldAlert,
        critical: ShieldX,
    }[riskLevel]

    if (isLoading) {
        return (
            <div className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} bg-surface/20 
                           border border-border rounded font-mono uppercase animate-pulse ${className}`}>
                <Shield size={iconSize[size]} className="opacity-50" />
                <span className="opacity-50">ANALYZING...</span>
            </div>
        )
    }

    return (
        <div className={className}>
            {/* Main Badge */}
            <div
                className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} 
                           border rounded font-mono uppercase font-bold`}
                style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}50`,
                    color: color,
                }}
            >
                <Icon size={iconSize[size]} />
                <span>{label.replace(' ', '_')}</span>
                {size !== 'sm' && (
                    <span className="opacity-70">({riskScore})</span>
                )}
            </div>

            {/* Details */}
            {showDetails && requiredActions.length > 0 && (
                <div className="mt-2 space-y-1">
                    {requiredActions.includes('REQUIRE_HIGHER_STAKE') && (
                        <div className="flex items-center gap-1.5 text-[10px] text-warning uppercase font-mono">
                            <AlertTriangle size={12} />
                            <span>2x stake required</span>
                        </div>
                    )}
                    {requiredActions.includes('MANUAL_REVIEW') && (
                        <div className="flex items-center gap-1.5 text-[10px] text-warning uppercase font-mono">
                            <AlertTriangle size={12} />
                            <span>Orders need manual review</span>
                        </div>
                    )}
                    {requiredActions.includes('DELAYED_RELEASE') && (
                        <div className="flex items-center gap-1.5 text-[10px] text-warning uppercase font-mono">
                            <AlertTriangle size={12} />
                            <span>1hr release delay</span>
                        </div>
                    )}
                    {requiredActions.includes('BLOCK_ORDER') && (
                        <div className="flex items-center gap-1.5 text-[10px] text-error uppercase font-mono">
                            <ShieldX size={12} />
                            <span>Orders blocked</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/**
 * Inline Risk Badge (minimal version)
 */
export function RiskBadge({
    level,
    score,
}: {
    level: RiskLevel
    score?: number
}) {
    const color = getRiskColor(level)

    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 
                      rounded font-mono uppercase font-bold"
            style={{
                backgroundColor: `${color}20`,
                color: color,
            }}
        >
            {level}
            {score !== undefined && <span className="opacity-70">({score})</span>}
        </span>
    )
}

/**
 * Stake Requirement Display
 */
export function StakeRequirement({
    baseStake,
    multiplier,
    riskLevel,
}: {
    baseStake: number
    multiplier: number
    riskLevel: RiskLevel
}) {
    const requiredStake = baseStake * multiplier
    const color = getRiskColor(riskLevel)

    return (
        <div className="border border-border p-3 font-mono">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-text-secondary uppercase">Required Stake</span>
                <RiskBadge level={riskLevel} />
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">
                    ${requiredStake.toFixed(2)}
                </span>
                <span className="text-xs text-text-secondary">USDC</span>
            </div>
            {multiplier > 1 && (
                <div
                    className="text-[10px] mt-1 uppercase"
                    style={{ color }}
                >
                    {multiplier}x multiplier applied
                </div>
            )}
        </div>
    )
}

/**
 * Order Blocked Warning
 */
export function OrderBlockedWarning({ reason }: { reason?: string }) {
    return (
        <div className="border-2 border-error bg-error/10 p-4 font-mono">
            <div className="flex items-center gap-2 text-error mb-2">
                <ShieldX size={20} />
                <span className="font-bold uppercase">Order Blocked</span>
            </div>
            <p className="text-sm text-text-secondary">
                {reason || 'Your risk profile is too high to create orders at this time.'}
            </p>
            <p className="text-xs text-text-secondary mt-2 uppercase">
                {">"} Complete more successful trades to reduce risk score<br />
                {">"} Contact support if you believe this is an error
            </p>
        </div>
    )
}
