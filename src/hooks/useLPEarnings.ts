"use client"

import { useCallback, useState, useEffect } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { getContract, prepareContractCall, sendTransaction, readContract } from 'thirdweb'
import { thirdwebClient, defaultChain } from '@/lib/thirdweb-config'
import { CONTRACT_ADDRESSES } from '@/lib/web3-config'

const ESCROW_ADDRESS = CONTRACT_ADDRESSES.P2P_ESCROW as `0x${string}`

export interface LPEarningsData {
    totalEarnings: number      // Total ever earned (USDC)
    unclaimedEarnings: number  // Available to withdraw (USDC)
    lastClaimTime: Date | null
    totalVolume: number        // Total order volume processed
    completedOrders: number
}

export function useLPEarnings() {
    const account = useActiveAccount()
    const isConnected = !!account
    const [earnings, setEarnings] = useState<LPEarningsData>({
        totalEarnings: 0,
        unclaimedEarnings: 0,
        lastClaimTime: null,
        totalVolume: 0,
        completedOrders: 0,
    })
    const [isLoading, setIsLoading] = useState(false)
    const [isClaiming, setIsClaiming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const escrowContract = getContract({
        client: thirdwebClient,
        chain: defaultChain,
        address: ESCROW_ADDRESS,
    })

    // Fetch LP's earnings from contract
    const fetchEarnings = useCallback(async () => {
        if (!account?.address || !isConnected) return

        setIsLoading(true)
        setError(null)

        try {
            const stake = await readContract({
                contract: escrowContract,
                method: "function lpStakes(address) view returns (uint256 baseStake, uint256 lockedStake, uint256 availableStake, uint256 earnings, uint256 totalVolume, uint256 completedOrders, uint256 disputesLost, uint256 lastActiveTime, uint8 tier, bool isActive)",
                params: [account.address as `0x${string}`],
            })

            // Parse contract response
            const earningsRaw = stake[3] as bigint
            const volumeRaw = stake[4] as bigint
            const completedRaw = stake[5] as bigint

            setEarnings({
                totalEarnings: Number(earningsRaw) / 1_000_000, // USDC has 6 decimals
                unclaimedEarnings: Number(earningsRaw) / 1_000_000,
                lastClaimTime: null, // Would need separate tracking
                totalVolume: Number(volumeRaw) / 1_000_000,
                completedOrders: Number(completedRaw),
            })
        } catch (err) {
            console.error('[LPEarnings] Failed to fetch:', err)
            setError('Failed to fetch earnings')
        } finally {
            setIsLoading(false)
        }
    }, [account?.address, isConnected, escrowContract])

    // Claim all unclaimed earnings
    const claimEarnings = useCallback(async (): Promise<string | null> => {
        if (!account) {
            setError('Wallet not connected')
            return null
        }

        if (earnings.unclaimedEarnings <= 0) {
            setError('No earnings to claim')
            return null
        }

        setIsClaiming(true)
        setError(null)

        try {
            const tx = prepareContractCall({
                contract: escrowContract,
                method: "function claimEarnings()",
                params: [],
            })

            const result = await sendTransaction({
                transaction: tx,
                account,
            })

            console.log('[LPEarnings] Claimed:', result.transactionHash)
            
            // Refresh earnings after claim
            await fetchEarnings()
            
            return result.transactionHash
        } catch (err) {
            console.error('[LPEarnings] Claim failed:', err)
            setError('Failed to claim earnings')
            return null
        } finally {
            setIsClaiming(false)
        }
    }, [account, earnings.unclaimedEarnings, escrowContract, fetchEarnings])

    // Auto-fetch on mount and when account changes
    useEffect(() => {
        if (isConnected && account?.address) {
            fetchEarnings()
        }
    }, [isConnected, account?.address, fetchEarnings])

    return {
        earnings,
        isLoading,
        isClaiming,
        error,
        fetchEarnings,
        claimEarnings,
        hasEarnings: earnings.unclaimedEarnings > 0,
    }
}
