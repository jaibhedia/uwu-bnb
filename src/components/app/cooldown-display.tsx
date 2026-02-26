"use client"

import { Clock, AlertTriangle, Ban, Zap, UserPlus, Scale } from "lucide-react"
import { CooldownReason, formatTimeRemaining, getCooldownMessage } from "@/hooks/useCooldown"

interface CooldownDisplayProps {
    isOnCooldown: boolean
    reason: CooldownReason | null
    timeRemaining: number | null
    compact?: boolean
}

const REASON_CONFIG: Record<CooldownReason, {
    icon: typeof Clock
    color: string
    bgColor: string
}> = {
    new_account: {
        icon: UserPlus,
        color: 'text-brand',
        bgColor: 'bg-brand/10 border-brand/20'
    },
    dispute_raised: {
        icon: Scale,
        color: 'text-warning',
        bgColor: 'bg-warning/10 border-warning/20'
    },
    order_abandoned: {
        icon: AlertTriangle,
        color: 'text-warning',
        bgColor: 'bg-warning/10 border-warning/20'
    },
    velocity_limit: {
        icon: Zap,
        color: 'text-brand',
        bgColor: 'bg-brand/10 border-brand/20'
    },
    dispute_lost: {
        icon: Ban,
        color: 'text-error',
        bgColor: 'bg-error/10 border-error/20'
    },
    lp_post_order: {
        icon: Clock,
        color: 'text-text-secondary',
        bgColor: 'bg-background border-border'
    }
}

/**
 * Display cooldown status with countdown
 */
export function CooldownDisplay({ 
    isOnCooldown, 
    reason, 
    timeRemaining,
    compact = false 
}: CooldownDisplayProps) {
    if (!isOnCooldown || !reason) return null
    
    const config = REASON_CONFIG[reason]
    const Icon = config.icon
    const message = getCooldownMessage(reason)
    const formattedTime = timeRemaining ? formatTimeRemaining(timeRemaining) : null
    
    // Banned state (no countdown)
    if (reason === 'dispute_lost') {
        return (
            <div className={`${config.bgColor} border p-4`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
                        <Ban className="w-5 h-5 text-error" />
                    </div>
                    <div>
                        <p className="font-bold text-error">Account Suspended</p>
                        <p className="text-sm text-text-secondary">
                            Your account has been permanently suspended due to losing a dispute.
                        </p>
                    </div>
                </div>
            </div>
        )
    }
    
    if (compact) {
        return (
            <div className={`${config.bgColor} border px-3 py-2 flex items-center gap-2`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="text-sm text-text-secondary">
                    Cooldown: <span className={`font-mono font-bold ${config.color}`}>{formattedTime}</span>
                </span>
            </div>
        )
    }
    
    return (
        <div className={`${config.bgColor} border p-4`}>
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <p className={`font-bold ${config.color}`}>On Cooldown</p>
                        {formattedTime && (
                            <p className={`font-mono text-lg font-bold ${config.color}`}>
                                {formattedTime}
                            </p>
                        )}
                    </div>
                    <p className="text-sm text-text-secondary">{message}</p>
                </div>
            </div>
        </div>
    )
}

/**
 * Inline cooldown badge
 */
export function CooldownBadge({ 
    reason, 
    timeRemaining 
}: { 
    reason: CooldownReason
    timeRemaining: number | null 
}) {
    const config = REASON_CONFIG[reason]
    const Icon = config.icon
    
    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${config.bgColor} border`}>
            <Icon className={`w-3 h-3 ${config.color}`} />
            <span className={`text-xs font-medium ${config.color}`}>
                {timeRemaining ? formatTimeRemaining(timeRemaining) : 'Banned'}
            </span>
        </div>
    )
}

/**
 * Velocity limit warning
 */
export function VelocityWarning({ 
    ordersRemaining, 
    maxOrders = 5 
}: { 
    ordersRemaining: number
    maxOrders?: number
}) {
    if (ordersRemaining >= maxOrders) return null
    
    const isAtLimit = ordersRemaining === 0
    const isNearLimit = ordersRemaining <= 2
    
    return (
        <div className={`
            flex items-center gap-2 px-3 py-2 text-sm
            ${isAtLimit 
                ? 'bg-error/10 border border-error/20 text-error' 
                : isNearLimit 
                    ? 'bg-warning/10 border border-warning/20 text-warning'
                    : 'bg-background border border-border text-text-secondary'
            }
        `}>
            <Zap className="w-4 h-4" />
            {isAtLimit ? (
                <span>Order limit reached. Wait 30 minutes.</span>
            ) : (
                <span>{ordersRemaining} of {maxOrders} orders remaining this hour</span>
            )}
        </div>
    )
}

/**
 * Daily limit progress bar
 */
export function DailyLimitProgress({
    used,
    limit,
    trustLevel
}: {
    used: number
    limit: number
    trustLevel: 'new' | 'established' | 'high_trust'
}) {
    const percentage = Math.min(100, (used / limit) * 100)
    const remaining = Math.max(0, limit - used)
    const isNearLimit = percentage >= 80
    const isAtLimit = percentage >= 100
    
    const formatAmount = (amount: number) => `$${(amount / 1_000000).toFixed(0)}`
    
    const levelLabels = {
        new: 'New User',
        established: 'Established',
        high_trust: 'High Trust'
    }
    
    return (
        <div className="bg-surface border border-border p-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-secondary">Daily Limit</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                    trustLevel === 'high_trust' 
                        ? 'bg-success/10 text-success' 
                        : trustLevel === 'established'
                            ? 'bg-warning/10 text-warning'
                            : 'bg-background text-text-secondary'
                }`}>
                    {levelLabels[trustLevel]}
                </span>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-background rounded-full overflow-hidden mb-2">
                <div 
                    className={`h-full transition-all duration-300 ${
                        isAtLimit 
                            ? 'bg-error' 
                            : isNearLimit 
                                ? 'bg-warning' 
                                : 'bg-brand'
                    }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            
            <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                    Used: {formatAmount(used)}
                </span>
                <span className={`font-medium ${isAtLimit ? 'text-error' : 'text-text-primary'}`}>
                    {formatAmount(remaining)} remaining
                </span>
            </div>
        </div>
    )
}
