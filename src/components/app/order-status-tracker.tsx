"use client"

import { CheckCircle, Circle, Clock, AlertTriangle, Loader2, Ban, ArrowRight } from "lucide-react"

export type OrderStatus = 
    | "pending"           // Waiting for LP match
    | "matched"           // LP matched, waiting for payment
    | "payment_sent"      // User marked as paid, awaiting confirmation
    | "payment_confirmed" // LP confirmed receipt
    | "releasing"         // Funds being released
    | "completed"         // Order complete
    | "disputed"          // In dispute
    | "cancelled"         // Order cancelled
    | "expired"           // Order expired

interface OrderStatusTrackerProps {
    status: OrderStatus
    createdAt?: number
    completedAt?: number
    lpName?: string
    amount?: number
    showDetails?: boolean
    compact?: boolean
}

const STATUS_CONFIG: Record<OrderStatus, {
    label: string
    description: string
    color: string
    icon: typeof CheckCircle
    step: number
}> = {
    pending: {
        label: "Finding LP",
        description: "Matching you with a liquidity provider",
        color: "text-brand",
        icon: Loader2,
        step: 1
    },
    matched: {
        label: "LP Matched",
        description: "Send payment to the LP's UPI",
        color: "text-brand",
        icon: CheckCircle,
        step: 2
    },
    payment_sent: {
        label: "Payment Sent",
        description: "Waiting for LP to confirm receipt",
        color: "text-warning",
        icon: Clock,
        step: 3
    },
    payment_confirmed: {
        label: "Confirmed",
        description: "LP confirmed payment, releasing funds",
        color: "text-success",
        icon: CheckCircle,
        step: 4
    },
    releasing: {
        label: "Releasing",
        description: "USDC being transferred to your wallet",
        color: "text-brand",
        icon: Loader2,
        step: 4
    },
    completed: {
        label: "Complete",
        description: "Order completed successfully",
        color: "text-success",
        icon: CheckCircle,
        step: 5
    },
    disputed: {
        label: "Disputed",
        description: "Under review by arbitrators",
        color: "text-error",
        icon: AlertTriangle,
        step: -1
    },
    cancelled: {
        label: "Cancelled",
        description: "Order was cancelled",
        color: "text-text-secondary",
        icon: Ban,
        step: -1
    },
    expired: {
        label: "Expired",
        description: "Order timed out",
        color: "text-text-secondary",
        icon: Clock,
        step: -1
    }
}

const STEPS = [
    { step: 1, label: "Order", shortLabel: "1" },
    { step: 2, label: "Matched", shortLabel: "2" },
    { step: 3, label: "Paid", shortLabel: "3" },
    { step: 4, label: "Confirm", shortLabel: "4" },
    { step: 5, label: "Done", shortLabel: "✓" }
]

export function OrderStatusTracker({ 
    status, 
    createdAt, 
    completedAt, 
    lpName,
    amount,
    showDetails = true,
    compact = false
}: OrderStatusTrackerProps) {
    const config = STATUS_CONFIG[status]
    const Icon = config.icon
    const currentStep = config.step
    const isError = currentStep === -1

    // Calculate duration
    const duration = createdAt 
        ? completedAt 
            ? Math.floor((completedAt - createdAt) / 1000)
            : Math.floor((Date.now() - createdAt) / 1000)
        : 0
    
    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    }

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${config.color} ${status === 'pending' || status === 'releasing' ? 'animate-spin' : ''}`} />
                <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                {!isError && (
                    <span className="text-xs text-text-secondary">
                        ({currentStep}/5)
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className="bg-surface border border-border p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                        isError ? 'border-error bg-error/10' : 'border-brand bg-brand/10'
                    }`}>
                        <Icon className={`w-5 h-5 ${config.color} ${status === 'pending' || status === 'releasing' ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                        <p className={`font-bold ${config.color}`}>{config.label}</p>
                        <p className="text-xs text-text-secondary">{config.description}</p>
                    </div>
                </div>
                {duration > 0 && (
                    <div className="text-right">
                        <p className="text-xs text-text-secondary">Elapsed</p>
                        <p className="text-sm font-mono text-text-primary">{formatDuration(duration)}</p>
                    </div>
                )}
            </div>

            {/* Progress Steps */}
            {!isError && (
                <div className="mb-4">
                    {/* Step indicators */}
                    <div className="flex items-center justify-between mb-2">
                        {STEPS.map((step, index) => {
                            const isComplete = currentStep >= step.step
                            const isCurrent = currentStep === step.step
                            
                            return (
                                <div key={step.step} className="flex items-center flex-1">
                                    {/* Step circle */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                        transition-all duration-300
                                        ${isComplete 
                                            ? 'bg-brand text-white' 
                                            : isCurrent 
                                                ? 'bg-brand/20 text-brand border-2 border-brand' 
                                                : 'bg-background text-text-secondary border border-border'
                                        }
                                    `}>
                                        {isComplete && step.step < currentStep ? (
                                            <CheckCircle className="w-4 h-4" />
                                        ) : (
                                            step.shortLabel
                                        )}
                                    </div>
                                    
                                    {/* Connector line */}
                                    {index < STEPS.length - 1 && (
                                        <div className={`
                                            flex-1 h-0.5 mx-1
                                            ${currentStep > step.step ? 'bg-brand' : 'bg-border'}
                                        `} />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    
                    {/* Step labels */}
                    <div className="flex justify-between">
                        {STEPS.map((step) => (
                            <p key={step.step} className={`text-[10px] text-center w-8 ${
                                currentStep >= step.step ? 'text-brand' : 'text-text-secondary'
                            }`}>
                                {step.label}
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* Additional Details */}
            {showDetails && (lpName || amount) && (
                <div className="bg-background border border-border p-3 space-y-2">
                    {lpName && (
                        <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">LP</span>
                            <span className="text-text-primary font-medium">{lpName}</span>
                        </div>
                    )}
                    {amount && (
                        <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">Amount</span>
                            <span className="text-text-primary font-medium">${amount.toFixed(2)} USDC</span>
                        </div>
                    )}
                </div>
            )}

            {/* Action hint based on status */}
            {status === 'matched' && (
                <div className="mt-3 bg-warning/10 border border-warning/20 p-3">
                    <p className="text-sm text-warning font-medium flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        Send payment via UPI and mark as paid
                    </p>
                </div>
            )}
            
            {status === 'payment_sent' && (
                <div className="mt-3 bg-brand/10 border border-brand/20 p-3">
                    <p className="text-sm text-brand font-medium flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Waiting for LP confirmation (~2-5 min)
                    </p>
                </div>
            )}

            {status === 'disputed' && (
                <div className="mt-3 bg-error/10 border border-error/20 p-3">
                    <p className="text-sm text-error font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Dispute resolution typically takes 4 hours max
                    </p>
                </div>
            )}
        </div>
    )
}

/**
 * Compact inline status for lists
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
    const config = STATUS_CONFIG[status]
    const Icon = config.icon
    
    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
            status === 'completed' ? 'bg-success/10 text-success' :
            status === 'disputed' || status === 'cancelled' ? 'bg-error/10 text-error' :
            status === 'expired' ? 'bg-background text-text-secondary' :
            'bg-brand/10 text-brand'
        }`}>
            <Icon className={`w-3 h-3 ${status === 'pending' || status === 'releasing' ? 'animate-spin' : ''}`} />
            {config.label}
        </div>
    )
}
