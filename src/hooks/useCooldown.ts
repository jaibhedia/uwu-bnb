"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Cooldown System Types and Configuration
 * 
 * COOLDOWNS:
 * - LP completes order: 30-60 sec
 * - User raises dispute: 24 hours
 * - Loses dispute: BANNED
 * - Abandons order: 12 hours
 * - 5 orders in 1 hour: 30 min
 * - New account: 10 min before first order
 */

export interface CooldownConfig {
    LP_POST_ORDER: number       // 45 seconds
    DISPUTE_RAISED: number      // 24 hours
    ORDER_ABANDONED: number     // 12 hours
    VELOCITY_LIMIT: number      // 30 minutes
    NEW_ACCOUNT: number         // 10 minutes
    LP_OFFLINE: number          // 15 minutes
}

export const COOLDOWN_MS: CooldownConfig = {
    LP_POST_ORDER: 45 * 1000,
    DISPUTE_RAISED: 24 * 60 * 60 * 1000,
    ORDER_ABANDONED: 12 * 60 * 60 * 1000,
    VELOCITY_LIMIT: 30 * 60 * 1000,
    NEW_ACCOUNT: 10 * 60 * 1000,
    LP_OFFLINE: 15 * 60 * 1000
}

export const VELOCITY_CONFIG = {
    MAX_ORDERS_PER_HOUR: 5,
    WINDOW_MS: 60 * 60 * 1000  // 1 hour
}

export interface CooldownState {
    isOnCooldown: boolean
    cooldownUntil: number | null
    reason: CooldownReason | null
    timeRemaining: number | null
    formattedTime: string | null
}

export type CooldownReason = 
    | 'new_account'
    | 'dispute_raised'
    | 'order_abandoned'
    | 'velocity_limit'
    | 'dispute_lost'
    | 'lp_post_order'

/**
 * Hook for managing user cooldowns
 */
export function useCooldown(userAddress: string | null) {
    const [cooldownState, setCooldownState] = useState<CooldownState>({
        isOnCooldown: false,
        cooldownUntil: null,
        reason: null,
        timeRemaining: null,
        formattedTime: null
    })
    const [isLoading, setIsLoading] = useState(true)

    // Fetch cooldown status from API/contract
    const fetchCooldownStatus = useCallback(async () => {
        if (!userAddress) {
            setCooldownState({
                isOnCooldown: false,
                cooldownUntil: null,
                reason: null,
                timeRemaining: null,
                formattedTime: null
            })
            setIsLoading(false)
            return
        }

        try {
            const response = await fetch(`/api/users/${userAddress}/cooldown`)
            if (!response.ok) throw new Error('Failed to fetch cooldown')
            
            const data = await response.json()
            
            if (data.cooldownUntil && data.cooldownUntil > Date.now()) {
                setCooldownState({
                    isOnCooldown: true,
                    cooldownUntil: data.cooldownUntil,
                    reason: data.reason,
                    timeRemaining: data.cooldownUntil - Date.now(),
                    formattedTime: formatTimeRemaining(data.cooldownUntil - Date.now())
                })
            } else {
                setCooldownState({
                    isOnCooldown: false,
                    cooldownUntil: null,
                    reason: null,
                    timeRemaining: null,
                    formattedTime: null
                })
            }
        } catch (error) {
            console.error('Error fetching cooldown:', error)
        } finally {
            setIsLoading(false)
        }
    }, [userAddress])

    // Initial fetch
    useEffect(() => {
        fetchCooldownStatus()
    }, [fetchCooldownStatus])

    // Countdown timer
    useEffect(() => {
        if (!cooldownState.isOnCooldown || !cooldownState.cooldownUntil) return

        const interval = setInterval(() => {
            const remaining = cooldownState.cooldownUntil! - Date.now()
            
            if (remaining <= 0) {
                setCooldownState(prev => ({
                    ...prev,
                    isOnCooldown: false,
                    timeRemaining: null,
                    formattedTime: null
                }))
                clearInterval(interval)
            } else {
                setCooldownState(prev => ({
                    ...prev,
                    timeRemaining: remaining,
                    formattedTime: formatTimeRemaining(remaining)
                }))
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [cooldownState.isOnCooldown, cooldownState.cooldownUntil])

    return {
        ...cooldownState,
        isLoading,
        refresh: fetchCooldownStatus
    }
}

/**
 * Hook for tracking velocity limits
 */
export function useVelocityLimit(userAddress: string | null) {
    const [orderTimes, setOrderTimes] = useState<number[]>([])
    const [isAtLimit, setIsAtLimit] = useState(false)
    const [ordersRemaining, setOrdersRemaining] = useState(VELOCITY_CONFIG.MAX_ORDERS_PER_HOUR)

    // Calculate orders in current window
    useEffect(() => {
        const now = Date.now()
        const cutoff = now - VELOCITY_CONFIG.WINDOW_MS
        const recentOrders = orderTimes.filter(t => t >= cutoff)
        
        setOrdersRemaining(VELOCITY_CONFIG.MAX_ORDERS_PER_HOUR - recentOrders.length)
        setIsAtLimit(recentOrders.length >= VELOCITY_CONFIG.MAX_ORDERS_PER_HOUR)
    }, [orderTimes])

    const recordOrder = useCallback(() => {
        setOrderTimes(prev => [...prev, Date.now()])
    }, [])

    const checkCanOrder = useCallback((): boolean => {
        const now = Date.now()
        const cutoff = now - VELOCITY_CONFIG.WINDOW_MS
        const recentOrders = orderTimes.filter(t => t >= cutoff)
        return recentOrders.length < VELOCITY_CONFIG.MAX_ORDERS_PER_HOUR
    }, [orderTimes])

    return {
        isAtLimit,
        ordersRemaining,
        recordOrder,
        checkCanOrder,
        recentOrderCount: VELOCITY_CONFIG.MAX_ORDERS_PER_HOUR - ordersRemaining
    }
}

/**
 * Hook for LP offline detection
 */
export function useLPOfflineDetection(
    orderId: string | null,
    lpLastActiveAt: number | null,
    onOfflineDetected?: () => void
) {
    const [isOffline, setIsOffline] = useState(false)
    const [timeSinceActive, setTimeSinceActive] = useState<number | null>(null)
    const hasTriggered = useRef(false)

    useEffect(() => {
        if (!orderId || !lpLastActiveAt) {
            setIsOffline(false)
            setTimeSinceActive(null)
            hasTriggered.current = false
            return
        }

        const interval = setInterval(() => {
            const elapsed = Date.now() - lpLastActiveAt
            setTimeSinceActive(elapsed)

            if (elapsed >= COOLDOWN_MS.LP_OFFLINE) {
                setIsOffline(true)
                if (!hasTriggered.current) {
                    hasTriggered.current = true
                    onOfflineDetected?.()
                }
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [orderId, lpLastActiveAt, onOfflineDetected])

    return {
        isOffline,
        timeSinceActive,
        formattedTime: timeSinceActive ? formatTimeRemaining(COOLDOWN_MS.LP_OFFLINE - timeSinceActive) : null,
        timeoutAt: lpLastActiveAt ? lpLastActiveAt + COOLDOWN_MS.LP_OFFLINE : null
    }
}

// ============================================
// Utility Functions
// ============================================

export function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return '0s'
    
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
}

export function getCooldownMessage(reason: CooldownReason): string {
    const messages: Record<CooldownReason, string> = {
        new_account: 'New accounts must wait 10 minutes before placing their first order',
        dispute_raised: 'You\'re on cooldown after raising a dispute. Please wait 24 hours.',
        order_abandoned: 'Order abandonment cooldown. Please wait 12 hours.',
        velocity_limit: 'You\'ve reached the maximum of 5 orders per hour. Please wait 30 minutes.',
        dispute_lost: 'Your account has been suspended due to losing a dispute.',
        lp_post_order: 'Short cooldown between orders for LP.'
    }
    return messages[reason] || 'You\'re currently on cooldown.'
}

export function getCooldownIcon(reason: CooldownReason): string {
    const icons: Record<CooldownReason, string> = {
        new_account: '🆕',
        dispute_raised: '⚖️',
        order_abandoned: '🚪',
        velocity_limit: '⚡',
        dispute_lost: '🚫',
        lp_post_order: '⏱️'
    }
    return icons[reason] || '⏳'
}
