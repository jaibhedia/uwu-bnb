"use client"

import { Users, Clock, Bell, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyLPStateProps {
    onRefresh?: () => void
    onNotify?: () => void
    isRefreshing?: boolean
    reason?: "offline" | "busy" | "none" | "low_liquidity"
}

/**
 * Empty state shown when no LPs are available
 * Provides context and actions for users
 */
export function EmptyLPState({ 
    onRefresh, 
    onNotify, 
    isRefreshing = false,
    reason = "none"
}: EmptyLPStateProps) {
    const reasons = {
        offline: {
            icon: Clock,
            title: "All LPs Currently Offline",
            description: "Liquidity providers operate 9 AM - 11 PM IST. Try again during active hours.",
            suggestion: "Peak hours: 10 AM - 8 PM IST"
        },
        busy: {
            icon: Users,
            title: "All LPs Busy",
            description: "High demand right now. LPs are processing other orders.",
            suggestion: "New LPs available every 2-5 minutes"
        },
        low_liquidity: {
            icon: AlertCircle,
            title: "Insufficient Liquidity",
            description: "No LP has enough stake for your order size.",
            suggestion: "Try a smaller amount or wait for more liquidity"
        },
        none: {
            icon: Users,
            title: "No Liquidity Providers Available",
            description: "We're actively onboarding new LPs to serve you better.",
            suggestion: "Check back in a few minutes"
        }
    }

    const config = reasons[reason]
    const Icon = config.icon

    return (
        <div className="bg-surface border border-border p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-4 bg-background border border-border rounded-full flex items-center justify-center">
                <Icon className="w-8 h-8 text-text-secondary" />
            </div>

            {/* Message */}
            <h3 className="text-lg font-bold text-text-primary mb-2">
                {config.title}
            </h3>
            <p className="text-sm text-text-secondary mb-1">
                {config.description}
            </p>
            <p className="text-xs text-brand mb-6">
                💡 {config.suggestion}
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3">
                {onRefresh && (
                    <Button
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className="w-full bg-brand hover:bg-brand/90"
                    >
                        {isRefreshing ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </>
                        )}
                    </Button>
                )}

                {onNotify && (
                    <Button
                        onClick={onNotify}
                        variant="outline"
                        className="w-full border-brand text-brand hover:bg-brand/10"
                    >
                        <Bell className="w-4 h-4 mr-2" />
                        Notify Me When Available
                    </Button>
                )}
            </div>

            {/* Stats hint */}
            <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-text-secondary">
                    Average wait time: <span className="text-text-primary font-medium">~3 minutes</span>
                </p>
            </div>
        </div>
    )
}

/**
 * Inline empty state for smaller sections
 */
export function EmptyLPInline({ message = "No LPs available" }: { message?: string }) {
    return (
        <div className="py-8 text-center text-text-secondary">
            <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{message}</p>
        </div>
    )
}

/**
 * Loading state while fetching LPs
 */
export function LoadingLPState() {
    return (
        <div className="space-y-3">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface border border-border p-4 animate-pulse">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <div className="h-5 bg-background rounded w-1/3 mb-2"></div>
                            <div className="h-3 bg-background rounded w-1/4"></div>
                        </div>
                        <div className="h-8 w-16 bg-background rounded"></div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {[1, 2, 3, 4].map((j) => (
                            <div key={j} className="h-12 bg-background rounded"></div>
                        ))}
                    </div>
                    <div className="h-8 bg-background rounded"></div>
                </div>
            ))}
        </div>
    )
}
