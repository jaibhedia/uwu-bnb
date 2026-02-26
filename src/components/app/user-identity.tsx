"use client"

import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface UserIdentityProps {
    address: string
    showAvatar?: boolean
    showCopy?: boolean
    trustScore?: number
    transactionCount?: number
}

/**
 * User identity display component
 * Shows avatar, trust score, and transaction stats
 */
export function UserIdentity({
    address,
    showAvatar = true,
    showCopy = true,
    trustScore,
    transactionCount,
}: UserIdentityProps) {
    const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="flex items-center gap-3">
            {showAvatar && (
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center">
                        <span className="text-white font-bold">
                            {displayName.slice(0, 2).toUpperCase()}
                        </span>
                    </div>
                    {trustScore !== undefined && (
                        <div
                            className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-background ${trustScore >= 80
                                ? 'bg-success text-white'
                                : trustScore >= 50
                                    ? 'bg-warning text-background'
                                    : 'bg-error text-white'
                                }`}
                        >
                            {trustScore}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-text-primary font-medium truncate">
                        {displayName}
                    </span>
                    {showCopy && (
                        <button
                            onClick={handleCopy}
                            className="p-1 hover:bg-surface rounded transition-colors"
                            title="Copy address"
                        >
                            {copied ? (
                                <Check className="w-3 h-3 text-success" />
                            ) : (
                                <Copy className="w-3 h-3 text-text-secondary" />
                            )}
                        </button>
                    )}
                </div>
                {transactionCount !== undefined && (
                    <p className="text-xs text-text-secondary font-mono">
                        {transactionCount} transactions
                    </p>
                )}
            </div>
        </div>
    )
}
