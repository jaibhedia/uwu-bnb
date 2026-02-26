"use client"

import { useState, useEffect } from 'react'

export interface MerchantReputation {
    address: string
    trustScore: number
    totalTrades: number
    successfulTrades: number
    disputedTrades: number
    averageCompletionTime: number
    responseRate: number
    lastUpdated: number
    memberSince: number        // Timestamp when LP registered
    tier: number               // LP tier (1-5)
    stakedAmount: number       // USDC staked
    availableLiquidity: number // Stake minus locked in orders
}

/**
 * Hook for fetching and managing merchant reputation/trust scores
 * Queries the reputation API which calculates scores from transaction history
 */
export function useReputation(merchantAddress?: string) {
    const [reputation, setReputation] = useState<MerchantReputation | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (!merchantAddress) {
            setReputation(null)
            return
        }

        const fetchReputation = async () => {
            setIsLoading(true)
            setError(null)

            try {
                const response = await fetch(`/api/reputation?address=${merchantAddress}`)

                if (!response.ok) {
                    throw new Error('Failed to fetch reputation')
                }

                const data = await response.json()
                setReputation(data)
            } catch (err) {
                console.error('Error fetching reputation:', err)
                setError(err as Error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchReputation()
    }, [merchantAddress])

    /**
     * Update reputation after a transaction
     */
    const updateReputation = async (
        orderId: string,
        status: 'completed' | 'disputed' | 'cancelled',
        completionTime?: number
    ) => {
        if (!merchantAddress) return

        try {
            const response = await fetch('/api/reputation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    merchantAddress,
                    orderId,
                    status,
                    completionTime,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to update reputation')
            }

            const data = await response.json()
            setReputation(data.reputation)
        } catch (err) {
            console.error('Error updating reputation:', err)
        }
    }

    /**
     * Get trust score color based on score
     */
    const getTrustScoreColor = (score: number) => {
        if (score >= 95) return 'success'
        if (score >= 85) return 'warning'
        return 'error'
    }

    /**
     * Get trust score label
     */
    const getTrustScoreLabel = (score: number) => {
        if (score >= 95) return 'Excellent'
        if (score >= 85) return 'Good'
        if (score >= 70) return 'Fair'
        return 'Poor'
    }

    /**
     * Format completion time
     */
    const formatCompletionTime = (ms: number) => {
        const minutes = Math.floor(ms / 60000)
        if (minutes < 1) return '< 1 min'
        if (minutes < 60) return `${minutes} min`
        const hours = Math.floor(minutes / 60)
        return `${hours}h ${minutes % 60}m`
    }

    return {
        reputation,
        isLoading,
        error,
        updateReputation,
        getTrustScoreColor,
        getTrustScoreLabel,
        formatCompletionTime,
    }
}
