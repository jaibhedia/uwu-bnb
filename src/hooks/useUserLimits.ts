"use client"

import { useState, useEffect, useCallback } from 'react'

/**
 * User Order Limits
 * 
 * ALL regular users have a flat $150 USDC per-order limit.
 * LPs are limited by their staked USDC amount (handled separately in useStaking).
 */

export const USER_MAX_ORDER_USDC = 150  // $150 per order

export interface UserLimitData {
    maxOrderUsdc: number       // USDC cap
    completedTrades: number
    disputesLost: number
}

/**
 * Hook for user order limits
 */
export function useUserLimits(userAddress: string | null) {
    const [limitData, setLimitData] = useState<UserLimitData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchLimits = useCallback(async () => {
        if (!userAddress) {
            setLimitData(null)
            setIsLoading(false)
            return
        }

        try {
            const response = await fetch(`/api/users/${userAddress}/limits`)
            if (!response.ok) throw new Error('Failed to fetch limits')

            const data = await response.json()

            setLimitData({
                maxOrderUsdc: USER_MAX_ORDER_USDC,
                completedTrades: data.completedTrades || 0,
                disputesLost: data.disputesLost || 0,
            })
            setError(null)
        } catch (err) {
            console.error('Error fetching user limits:', err)
            setError(err as Error)

            setLimitData({
                maxOrderUsdc: USER_MAX_ORDER_USDC,
                completedTrades: 0,
                disputesLost: 0,
            })
        } finally {
            setIsLoading(false)
        }
    }, [userAddress])

    useEffect(() => {
        fetchLimits()
    }, [fetchLimits])

    /**
     * Check whether a given USDC amount is within the user's limit
     */
    const canMakeOrder = useCallback((amountUsdc: number): boolean => {
        return amountUsdc <= USER_MAX_ORDER_USDC
    }, [])

    return {
        limitData,
        isLoading,
        error,
        canMakeOrder,
        refresh: fetchLimits,
    }
}
