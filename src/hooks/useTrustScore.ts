"use client"

import { useState, useCallback, useEffect } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { getContract, readContract } from 'thirdweb'
import { thirdwebClient, defaultChain } from '@/lib/thirdweb-config'
import { CONTRACT_ADDRESSES } from '@/lib/web3-config'

/**
 * TrustScore Contract ABI (read functions)
 */
const TRUST_SCORE_ABI = [
    {
        inputs: [{ name: "user", type: "address" }],
        name: "getTrustScore",
        outputs: [{ name: "score", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "user", type: "address" }],
        name: "reputations",
        outputs: [
            { name: "completedTrades", type: "uint256" },
            { name: "totalVolume", type: "uint256" },
            { name: "successfulReleases", type: "uint256" },
            { name: "disputes", type: "uint256" },
            { name: "disputesLost", type: "uint256" },
            { name: "firstTradeAt", type: "uint256" },
            { name: "lastTradeAt", type: "uint256" },
            { name: "isLP", type: "bool" },
            { name: "lpStake", type: "uint256" }
        ],
        stateMutability: "view",
        type: "function"
    },
    {
        inputs: [{ name: "user", type: "address" }],
        name: "getTier",
        outputs: [{ name: "tier", type: "uint8" }],
        stateMutability: "view",
        type: "function"
    }
] as const

export type TrustTier = 'New' | 'Trusted' | 'Verified' | 'Expert' | 'Elite'

export interface TrustScoreData {
    score: number               // 0-100
    completedTrades: number
    totalVolume: number         // in USDC
    successfulReleases: number
    disputes: number
    disputesLost: number
    disputeRatio: number        // 0-100%
    accountAge: number          // days
    avgCompletionTime: number   // seconds (estimated)
    isLP: boolean
    lpStake: number
    tier: TrustTier
}

export const TRUST_TIER_CONFIG: Record<TrustTier, { minScore: number; color: string; description: string }> = {
    'New': { minScore: 0, color: 'gray', description: 'New to the platform' },
    'Trusted': { minScore: 60, color: 'green', description: '10+ successful trades' },
    'Verified': { minScore: 75, color: 'blue', description: '50+ trades, low dispute rate' },
    'Expert': { minScore: 85, color: 'purple', description: '100+ trades, excellent record' },
    'Elite': { minScore: 95, color: 'gold', description: 'Top performer, LP status' }
}

/**
 * Hook for reading trust scores from the on-chain TrustScore contract
 */
export function useTrustScore(userAddress?: string) {
    const account = useActiveAccount()
    const address = userAddress || account?.address
    
    const [trustData, setTrustData] = useState<TrustScoreData | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    // Get contract instance
    const getTrustScoreContract = useCallback(() => {
        return getContract({
            client: thirdwebClient,
            chain: defaultChain,
            address: CONTRACT_ADDRESSES.TRUST_SCORE,
            abi: TRUST_SCORE_ABI,
        })
    }, [])

    /**
     * Calculate tier from score
     */
    const getTierFromScore = useCallback((score: number): TrustTier => {
        if (score >= 95) return 'Elite'
        if (score >= 85) return 'Expert'
        if (score >= 75) return 'Verified'
        if (score >= 60) return 'Trusted'
        return 'New'
    }, [])

    /**
     * Calculate dispute ratio
     */
    const calculateDisputeRatio = useCallback((disputes: number, completedTrades: number): number => {
        if (completedTrades === 0) return 0
        return Math.round((disputes / completedTrades) * 100)
    }, [])

    /**
     * Calculate account age in days
     */
    const calculateAccountAge = useCallback((firstTradeAt: number): number => {
        if (firstTradeAt === 0) return 0
        const now = Math.floor(Date.now() / 1000)
        return Math.floor((now - firstTradeAt) / (24 * 60 * 60))
    }, [])

    /**
     * Fetch trust score from contract
     */
    const fetchTrustScore = useCallback(async () => {
        if (!address) return null

        setIsLoading(true)
        setError(null)

        try {
            const contract = getTrustScoreContract()

            // Fetch score
            const score = await readContract({
                contract,
                method: "getTrustScore",
                params: [address as `0x${string}`],
            }) as bigint

            // Fetch reputation details
            const reputation = await readContract({
                contract,
                method: "reputations",
                params: [address as `0x${string}`],
            }) as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, boolean, bigint]

            const completedTrades = Number(reputation[0])
            const disputes = Number(reputation[3])
            const firstTradeAt = Number(reputation[5])
            const scoreNum = Number(score)

            const data: TrustScoreData = {
                score: scoreNum,
                completedTrades,
                totalVolume: Number(reputation[1]) / 1e6,  // Convert from 6 decimals
                successfulReleases: Number(reputation[2]),
                disputes,
                disputesLost: Number(reputation[4]),
                disputeRatio: calculateDisputeRatio(disputes, completedTrades),
                accountAge: calculateAccountAge(firstTradeAt),
                avgCompletionTime: 420,  // Estimated 7 minutes average
                isLP: reputation[7],
                lpStake: Number(reputation[8]) / 1e6,
                tier: getTierFromScore(scoreNum)
            }

            setTrustData(data)
            return data
        } catch (err) {
            console.error('[TrustScore] Failed to fetch:', err)
            
            // Return default data for new users
            const defaultData: TrustScoreData = {
                score: 0,
                completedTrades: 0,
                totalVolume: 0,
                successfulReleases: 0,
                disputes: 0,
                disputesLost: 0,
                disputeRatio: 0,
                accountAge: 0,
                avgCompletionTime: 0,
                isLP: false,
                lpStake: 0,
                tier: 'New'
            }
            setTrustData(defaultData)
            return defaultData
        } finally {
            setIsLoading(false)
        }
    }, [address, getTrustScoreContract, getTierFromScore, calculateDisputeRatio, calculateAccountAge])

    // Auto-fetch on mount
    useEffect(() => {
        if (address) {
            fetchTrustScore()
        }
    }, [address, fetchTrustScore])

    /**
     * Get color for trust score
     */
    const getScoreColor = useCallback((score: number): string => {
        if (score >= 90) return 'text-success'
        if (score >= 70) return 'text-brand'
        if (score >= 50) return 'text-warning'
        return 'text-error'
    }, [])

    /**
     * Get tier config
     */
    const getTierConfig = useCallback((tier: TrustTier) => {
        return TRUST_TIER_CONFIG[tier]
    }, [])

    /**
     * Check if user can become LP (based on trust score requirements)
     */
    const canBecomeLp = useCallback((): boolean => {
        if (!trustData) return false
        return trustData.score >= 70 && trustData.completedTrades >= 10
    }, [trustData])

    /**
     * Check if user can be arbitrator
     */
    const canBeArbitrator = useCallback((): boolean => {
        if (!trustData) return false
        return (
            trustData.score >= 85 &&
            trustData.completedTrades >= 50 &&
            trustData.disputeRatio <= 2 &&
            trustData.lpStake >= 500
        )
    }, [trustData])

    return {
        trustData,
        isLoading,
        error,
        fetchTrustScore,
        getScoreColor,
        getTierConfig,
        getTierFromScore,
        canBecomeLp,
        canBeArbitrator,
        TRUST_TIER_CONFIG
    }
}
