"use client"

import { useState, useCallback, useEffect } from 'react'
import { type RiskLevel } from '@/lib/platform-config'
import { type RiskAssessment } from '@/lib/fraud-detection'

/**
 * Hook for fetching and caching user fraud profiles
 */
export function useFraudProfile(userAddress: string | undefined) {
    const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    /**
     * Analyze risk for a specific order
     */
    const analyzeOrderRisk = useCallback(async (orderData: {
        amountUsdc: number
        paymentMethod?: string
        fiatCurrency?: string
        deviceId?: string
    }): Promise<RiskAssessment | null> => {
        if (!userAddress) return null

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/fraud/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderData,
                    userAddress,
                }),
            })

            const data = await response.json()

            if (!data.success) {
                throw new Error(data.error || 'Analysis failed')
            }

            const assessment: RiskAssessment = {
                riskScore: data.riskScore,
                riskLevel: data.riskLevel,
                requiredActions: data.requiredActions,
                maxOrderAmount: data.maxOrderAmount,
                requiredStake: data.requiredStake,
                blocked: data.blocked,
                signals: data.signals,
            }

            setRiskAssessment(assessment)
            return assessment
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error')
            setError(error)
            console.error('[FraudProfile] Analysis error:', error)
            return null
        } finally {
            setIsLoading(false)
        }
    }, [userAddress])

    /**
     * Quick check for UI feedback (cached)
     */
    const getQuickRiskLevel = useCallback((amountUsdc: number): RiskLevel => {
        if (riskAssessment) {
            return riskAssessment.riskLevel
        }
        // Default to low risk if no assessment yet
        return 'low'
    }, [riskAssessment])

    /**
     * Check if order is blocked
     */
    const isOrderBlocked = useCallback((amountUsdc: number): boolean => {
        if (!riskAssessment) return false

        // Check if amount exceeds max allowed
        if (amountUsdc > riskAssessment.maxOrderAmount) return true

        // Check if blocked by required actions
        return riskAssessment.blocked
    }, [riskAssessment])

    /**
     * Get required stake for order
     */
    const getRequiredStake = useCallback((amountUsdc: number): number => {
        if (!riskAssessment) {
            // Default 5% stake
            return amountUsdc * 0.05
        }
        return riskAssessment.requiredStake
    }, [riskAssessment])

    /**
     * Clear cached assessment
     */
    const clearAssessment = useCallback(() => {
        setRiskAssessment(null)
        setError(null)
    }, [])

    return {
        // Current assessment
        riskAssessment,
        riskLevel: riskAssessment?.riskLevel ?? 'low',
        riskScore: riskAssessment?.riskScore ?? 0,
        requiredActions: riskAssessment?.requiredActions ?? [],
        maxOrderAmount: riskAssessment?.maxOrderAmount ?? 10000,

        // Methods
        analyzeOrderRisk,
        getQuickRiskLevel,
        isOrderBlocked,
        getRequiredStake,
        clearAssessment,

        // State
        isLoading,
        error,
    }
}

/**
 * Risk level colors for UI
 */
export const RISK_COLORS = {
    low: '#10B981',      // Green
    medium: '#F59E0B',   // Yellow/Amber
    high: '#EF4444',     // Red
    critical: '#7C2D12', // Dark red
} as const

/**
 * Risk level labels
 */
export const RISK_LABELS = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
} as const

/**
 * Get risk color
 */
export function getRiskColor(level: RiskLevel): string {
    return RISK_COLORS[level]
}

/**
 * Get risk label
 */
export function getRiskLabel(level: RiskLevel): string {
    return RISK_LABELS[level]
}
