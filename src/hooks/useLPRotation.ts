"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * LP Selection Strategy for Round-Robin Rotation
 * 
 * Features:
 * - Round-robin rotation through active LPs
 * - Skip unresponsive LPs (>60s timeout)
 * - Post-order cooldown (30-60s)
 * - Daily volume limit checking
 * - Automatic rotation on timeout
 */

export interface ActiveLP {
    address: string
    name: string
    stake: number
    tier: number
    availableLiquidity: number
    dailyLimitRemaining: number
    avgCompletionTime: number
    totalTrades: number
    isActive: boolean
    lastOrderTime: number
    cooldownUntil: number
}

interface LPRotationConfig {
    postOrderCooldown: number    // ms (default 45000 = 45s)
    unresponsiveTimeout: number  // ms (default 60000 = 60s)
    refreshInterval: number      // ms (default 10000 = 10s)
}

const DEFAULT_CONFIG: LPRotationConfig = {
    postOrderCooldown: 45000,     // 45 seconds
    unresponsiveTimeout: 60000,   // 60 seconds
    refreshInterval: 10000        // 10 seconds
}

/**
 * Hook for LP rotation and selection
 */
export function useLPRotation(config: Partial<LPRotationConfig> = {}) {
    const settings = { ...DEFAULT_CONFIG, ...config }
    
    const [activeLPs, setActiveLPs] = useState<ActiveLP[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    
    // Track assigned LP and time for timeout handling
    const assignmentRef = useRef<{
        orderId: string | null
        lpAddress: string | null
        assignedAt: number | null
    }>({ orderId: null, lpAddress: null, assignedAt: null })

    /**
     * Fetch active LPs from API
     */
    const fetchActiveLPs = useCallback(async () => {
        try {
            const response = await fetch('/api/lp/active')
            if (!response.ok) throw new Error('Failed to fetch LPs')
            
            const data = await response.json()
            setActiveLPs(data.lps || [])
            setError(null)
        } catch (err) {
            console.error('Error fetching LPs:', err)
            setError(err as Error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    // Initial fetch and refresh interval
    useEffect(() => {
        fetchActiveLPs()
        
        const interval = setInterval(fetchActiveLPs, settings.refreshInterval)
        return () => clearInterval(interval)
    }, [fetchActiveLPs, settings.refreshInterval])

    /**
     * Check if LP is eligible for an order
     */
    const isLPEligible = useCallback((lp: ActiveLP, orderAmount: number): boolean => {
        const now = Date.now()
        
        // Basic checks
        if (!lp.isActive) return false
        
        // Cooldown check
        if (lp.cooldownUntil > now) return false
        
        // Post-order cooldown
        if (lp.lastOrderTime && (now - lp.lastOrderTime) < settings.postOrderCooldown) {
            return false
        }
        
        // Liquidity check
        if (orderAmount > lp.availableLiquidity) return false
        
        // Daily limit check
        if (orderAmount > lp.dailyLimitRemaining) return false
        
        return true
    }, [settings.postOrderCooldown])

    /**
     * Get next available LP (round-robin)
     */
    const getNextLP = useCallback((orderAmount: number): ActiveLP | null => {
        if (activeLPs.length === 0) return null
        
        let checked = 0
        let idx = currentIndex
        
        while (checked < activeLPs.length) {
            const lp = activeLPs[idx]
            
            if (isLPEligible(lp, orderAmount)) {
                // Advance rotation for next call
                setCurrentIndex((idx + 1) % activeLPs.length)
                return lp
            }
            
            idx = (idx + 1) % activeLPs.length
            checked++
        }
        
        return null // No eligible LP found
    }, [activeLPs, currentIndex, isLPEligible])

    /**
     * Assign LP to an order
     */
    const assignLP = useCallback((orderId: string, orderAmount: number): ActiveLP | null => {
        const lp = getNextLP(orderAmount)
        
        if (lp) {
            assignmentRef.current = {
                orderId,
                lpAddress: lp.address,
                assignedAt: Date.now()
            }
        }
        
        return lp
    }, [getNextLP])

    /**
     * Check if current assignment has timed out
     */
    const isAssignmentTimedOut = useCallback((): boolean => {
        const { assignedAt } = assignmentRef.current
        if (!assignedAt) return false
        
        return (Date.now() - assignedAt) > settings.unresponsiveTimeout
    }, [settings.unresponsiveTimeout])

    /**
     * Rotate to next LP (when current is unresponsive)
     */
    const rotateLP = useCallback(async (orderId: string, orderAmount: number): Promise<ActiveLP | null> => {
        const { lpAddress: currentLP } = assignmentRef.current
        
        // Skip the current unresponsive LP
        let newLP: ActiveLP | null = null
        let attempts = 0
        
        while (attempts < activeLPs.length) {
            const candidate = getNextLP(orderAmount)
            
            // Don't re-assign to the same LP
            if (candidate && candidate.address !== currentLP) {
                newLP = candidate
                break
            }
            
            attempts++
        }
        
        if (newLP) {
            // Notify backend about rotation
            try {
                await fetch('/api/lp/rotate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId,
                        oldLP: currentLP,
                        newLP: newLP.address,
                        reason: 'unresponsive'
                    })
                })
            } catch (err) {
                console.error('Failed to notify LP rotation:', err)
            }
            
            assignmentRef.current = {
                orderId,
                lpAddress: newLP.address,
                assignedAt: Date.now()
            }
        }
        
        return newLP
    }, [activeLPs, getNextLP])

    /**
     * Clear assignment (order completed/cancelled)
     */
    const clearAssignment = useCallback(() => {
        assignmentRef.current = {
            orderId: null,
            lpAddress: null,
            assignedAt: null
        }
    }, [])

    /**
     * Get LP by address
     */
    const getLPByAddress = useCallback((address: string): ActiveLP | undefined => {
        return activeLPs.find(lp => lp.address.toLowerCase() === address.toLowerCase())
    }, [activeLPs])

    /**
     * Get all eligible LPs for an order amount
     */
    const getEligibleLPs = useCallback((orderAmount: number): ActiveLP[] => {
        return activeLPs.filter(lp => isLPEligible(lp, orderAmount))
    }, [activeLPs, isLPEligible])

    /**
     * Get LP count stats
     */
    const getLPStats = useCallback(() => {
        const total = activeLPs.length
        const active = activeLPs.filter(lp => lp.isActive).length
        const onCooldown = activeLPs.filter(lp => lp.cooldownUntil > Date.now()).length
        const atDailyLimit = activeLPs.filter(lp => lp.dailyLimitRemaining <= 0).length
        
        return { total, active, onCooldown, atDailyLimit }
    }, [activeLPs])

    return {
        // State
        activeLPs,
        isLoading,
        error,
        currentIndex,
        
        // LP Selection
        getNextLP,
        assignLP,
        rotateLP,
        clearAssignment,
        isAssignmentTimedOut,
        
        // Utilities
        getLPByAddress,
        getEligibleLPs,
        isLPEligible,
        getLPStats,
        
        // Manual refresh
        refresh: fetchActiveLPs
    }
}

/**
 * Hook for monitoring LP response timeout
 */
export function useLPTimeout(
    orderId: string | null,
    assignedAt: number | null,
    timeout: number = 60000,
    onTimeout?: () => void
) {
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
    const [isTimedOut, setIsTimedOut] = useState(false)

    useEffect(() => {
        if (!orderId || !assignedAt) {
            setTimeRemaining(null)
            setIsTimedOut(false)
            return
        }

        const interval = setInterval(() => {
            const elapsed = Date.now() - assignedAt
            const remaining = Math.max(0, timeout - elapsed)
            
            setTimeRemaining(remaining)
            
            if (remaining === 0 && !isTimedOut) {
                setIsTimedOut(true)
                onTimeout?.()
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [orderId, assignedAt, timeout, isTimedOut, onTimeout])

    return {
        timeRemaining,
        isTimedOut,
        timeRemainingFormatted: timeRemaining !== null 
            ? `${Math.ceil(timeRemaining / 1000)}s` 
            : null
    }
}
