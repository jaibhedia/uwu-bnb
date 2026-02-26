"use client"

import { Shield, TrendingUp, Clock, CheckCircle, Calendar, AlertTriangle, Zap } from "lucide-react"
import { useReputation } from "@/hooks/useReputation"

interface MerchantCardProps {
    address: string
    name: string
    paymentDetails: string
    onSelect?: () => void
    showExtendedStats?: boolean
}

/**
 * Enhanced LP Card with Trust Signals
 * Shows: trades count, avg completion time, disputes, member since, tier
 */
export function MerchantCard({ address, name, paymentDetails, onSelect, showExtendedStats = true }: MerchantCardProps) {
    const { reputation, isLoading, getTrustScoreColor, getTrustScoreLabel, formatCompletionTime } = useReputation(address)

    if (isLoading || !reputation) {
        return (
            <div className="w-full bg-surface border border-border p-4 animate-pulse">
                <div className="h-6 bg-background rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-background rounded w-1/4"></div>
            </div>
        )
    }

    const trustColor = getTrustScoreColor(reputation.trustScore)
    const trustLabel = getTrustScoreLabel(reputation.trustScore)
    
    // Calculate member since duration
    const memberSince = reputation.memberSince || Date.now() - 30 * 24 * 60 * 60 * 1000 // Default 30 days
    const memberDays = Math.floor((Date.now() - memberSince) / (24 * 60 * 60 * 1000))
    const memberDuration = memberDays > 30 ? `${Math.floor(memberDays / 30)}mo` : `${memberDays}d`
    
    // Calculate dispute rate
    const disputeRate = reputation.totalTrades > 0 
        ? ((reputation.disputedTrades || 0) / reputation.totalTrades * 100).toFixed(1)
        : "0.0"

    const colorClasses = {
        success: 'bg-success/20 text-success border-success/20',
        warning: 'bg-warning/20 text-warning border-warning/20',
        error: 'bg-error/20 text-error border-error/20',
    }

    return (
        <button
            onClick={onSelect}
            className="w-full bg-surface border border-border p-4 hover:border-brand transition-colors text-left group"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-text-primary">{name}</p>
                        {reputation.trustScore >= 95 && (
                            <span title="Verified LP">
                                <Shield className="w-4 h-4 text-brand" />
                            </span>
                        )}
                        {reputation.totalTrades >= 100 && (
                            <span title="Power Trader">
                                <Zap className="w-4 h-4 text-warning" />
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-text-secondary font-mono">
                        {address.slice(0, 10)}...{address.slice(-8)}
                    </p>
                </div>

                {/* Trust Score Badge */}
                <div className={`px-3 py-1 rounded border ${colorClasses[trustColor]}`}>
                    <p className="text-xs font-bold">{reputation.trustScore}%</p>
                    <p className="text-[10px] uppercase">{trustLabel}</p>
                </div>
            </div>

            {/* Trust Signals Grid */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
                {/* Trades Count */}
                <div className="bg-background border border-border p-2">
                    <div className="flex items-center gap-1 mb-1">
                        <CheckCircle className="w-3 h-3 text-success" />
                        <p className="text-[8px] text-text-secondary uppercase">Trades</p>
                    </div>
                    <p className="text-sm font-bold text-text-primary">{reputation.totalTrades}</p>
                </div>

                {/* Avg Completion Time */}
                <div className="bg-background border border-border p-2">
                    <div className="flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3 text-brand" />
                        <p className="text-[8px] text-text-secondary uppercase">Avg</p>
                    </div>
                    <p className="text-sm font-bold text-text-primary">
                        {formatCompletionTime(reputation.averageCompletionTime)}
                    </p>
                </div>

                {/* Disputes */}
                <div className="bg-background border border-border p-2">
                    <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3 text-warning" />
                        <p className="text-[8px] text-text-secondary uppercase">Disputes</p>
                    </div>
                    <p className={`text-sm font-bold ${parseFloat(disputeRate) > 5 ? 'text-warning' : 'text-success'}`}>
                        {disputeRate}%
                    </p>
                </div>

                {/* Member Since */}
                <div className="bg-background border border-border p-2">
                    <div className="flex items-center gap-1 mb-1">
                        <Calendar className="w-3 h-3 text-text-secondary" />
                        <p className="text-[8px] text-text-secondary uppercase">Member</p>
                    </div>
                    <p className="text-sm font-bold text-text-primary">{memberDuration}</p>
                </div>
            </div>

            {/* Payment Details */}
            <div className="bg-brand/10 border border-brand/20 p-2 mb-2">
                <p className="text-xs text-text-secondary">{paymentDetails}</p>
            </div>

            {/* Warning for high dispute LPs */}
            {(reputation.disputedTrades || 0) > 2 && (
                <div className="text-xs text-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {reputation.disputedTrades} dispute{reputation.disputedTrades > 1 ? 's' : ''} • Exercise caution
                </div>
            )}

            {/* Hover indication */}
            <div className="mt-2 text-xs text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                → Select this LP
            </div>
        </button>
    )
}
