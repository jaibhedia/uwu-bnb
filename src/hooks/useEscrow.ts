"use client"

import { useState, useCallback, useEffect } from 'react'
import { useWallet } from './useWallet'
import { getContract, prepareContractCall, sendTransaction, waitForReceipt } from 'thirdweb'
import { thirdwebClient, defaultChain } from '@/lib/thirdweb-config'
import { CONTRACT_ADDRESSES, USDC_ADDRESS } from '@/lib/web3-config'
import { P2P_ESCROW_ABI, USDC_ABI, orderIdToBytes32, parseUsdc, formatUsdc, EscrowStatus } from '@/lib/escrow-abi'
import { useActiveAccount } from 'thirdweb/react'
import { getExchangeRate } from '@/lib/currency-converter'

/**
 * P2P Escrow Hook - BNB Chain (opBNB Testnet)
 * Manages order creation, payment confirmation, and escrow release
 */

export interface Order {
    id: string
    type: 'buy' | 'sell'
    buyer: string
    seller: string
    amountUsdc: number
    amountFiat: number
    currency: string
    status: 'pending' | 'awaiting_payment' | 'payment_sent' | 'confirmed' | 'completed' | 'cancelled' | 'disputed'
    createdAt: number
    expiresAt: number
    paymentMethod?: string
    merchantInfo?: {
        name: string
        paymentDetails: string
        trustScore: number
    }
    escrowTxHash?: string
    releaseTxHash?: string
}

export function useEscrow() {
    const { address, isConnected } = useWallet()
    const account = useActiveAccount()
    const [orders, setOrders] = useState<Order[]>([])
    const [isProcessing, setIsProcessing] = useState(false)

    // Get contract instances
    const getEscrowContract = useCallback(() => {
        return getContract({
            client: thirdwebClient,
            chain: defaultChain,
            address: CONTRACT_ADDRESSES.P2P_ESCROW,
            abi: P2P_ESCROW_ABI,
        })
    }, [])

    const getUsdcContract = useCallback(() => {
        return getContract({
            client: thirdwebClient,
            chain: defaultChain,
            address: USDC_ADDRESS,
            abi: USDC_ABI,
        })
    }, [])

    /**
     * Approve USDC spending for escrow contract
     */
    const approveUsdc = async (amount: number): Promise<string | null> => {
        if (!account) return null

        try {
            const usdcContract = getUsdcContract()
            const parsedAmount = parseUsdc(amount)

            const tx = prepareContractCall({
                contract: usdcContract,
                method: "approve",
                params: [CONTRACT_ADDRESSES.P2P_ESCROW, parsedAmount],
            })

            const result = await sendTransaction({
                transaction: tx,
                account,
            })

            const receipt = await waitForReceipt({
                client: thirdwebClient,
                chain: defaultChain,
                transactionHash: result.transactionHash,
            })

            console.log('[BNB] USDC approval confirmed:', receipt.transactionHash)
            return receipt.transactionHash
        } catch (error) {
            console.error('[BNB] USDC approval failed:', error)
            return null
        }
    }

    /**
     * Create a buy order (on-ramp: fiat → USDC)
     * User pays fiat to merchant, receives USDC from escrow
     */
    const createBuyOrder = async (
        amountFiat: number,
        currency: string,
        merchant: string,
        merchantInfo?: Order['merchantInfo']
    ): Promise<Order | null> => {
        if (!isConnected || !address) {
            throw new Error('Wallet not connected')
        }

        setIsProcessing(true)
        try {
            // Calculate USDC amount based on live exchange rate
            const exchangeRate = getExchangeRate(currency)
            const amountUsdc = amountFiat / exchangeRate

            // Generate order ID
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

            // Create order object
            const order: Order = {
                id: orderId,
                type: 'buy',
                buyer: address,
                seller: merchant,
                amountUsdc,
                amountFiat,
                currency,
                status: 'awaiting_payment',
                createdAt: Date.now(),
                expiresAt: Date.now() + (15 * 60 * 1000), // 15 minutes
                merchantInfo,
            }

            // For buy orders, the MERCHANT creates the escrow (locks their USDC)
            // The buyer just needs to pay fiat and confirm
            // This is a "pull" model where merchant pre-locks liquidity

            // Store order locally
            setOrders(prev => [...prev, order])

            console.log('[BNB] Buy order created:', orderId)
            return order
        } catch (error) {
            console.error('Failed to create buy order:', error)
            return null
        } finally {
            setIsProcessing(false)
        }
    }

    /**
     * Create a sell order (off-ramp: USDC → fiat)
     * User sends USDC to escrow, receives fiat from LP
     */
    const createSellOrder = async (
        amountUsdc: number,
        currency: string,
        merchant: string,
        merchantInfo?: Order['merchantInfo']
    ): Promise<Order | null> => {
        if (!isConnected || !address || !account) {
            throw new Error('Wallet not connected')
        }

        setIsProcessing(true)
        try {
            // Calculate fiat amount using live exchange rate
            const exchangeRate = getExchangeRate(currency)
            const amountFiat = amountUsdc * exchangeRate

            // Generate order ID
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            const orderIdBytes = orderIdToBytes32(orderId)

            // Step 1: Approve USDC for escrow contract
            console.log('[BNB] Approving USDC...')
            const approvalTx = await approveUsdc(amountUsdc)
            if (!approvalTx) {
                throw new Error('USDC approval failed')
            }

            // Step 2: Create escrow on BNB
            console.log('[BNB] Creating escrow...')
            const escrowContract = getEscrowContract()
            const parsedAmount = parseUsdc(amountUsdc)
            const expiresAt = BigInt(Math.floor(Date.now() / 1000) + (15 * 60)) // 15 mins from now
            const lpAddress = merchant as `0x${string}` // LP is the merchant handling the order

            const tx = prepareContractCall({
                contract: escrowContract,
                method: "createEscrow",
                params: [orderIdBytes, parsedAmount, lpAddress, lpAddress, expiresAt],
            })

            const result = await sendTransaction({
                transaction: tx,
                account,
            })

            const receipt = await waitForReceipt({
                client: thirdwebClient,
                chain: defaultChain,
                transactionHash: result.transactionHash,
            })

            console.log('[BNB] Escrow created:', receipt.transactionHash)

            // Create order object
            const order: Order = {
                id: orderId,
                type: 'sell',
                buyer: merchant,
                seller: address,
                amountUsdc,
                amountFiat,
                currency,
                status: 'awaiting_payment',
                createdAt: Date.now(),
                expiresAt: Date.now() + (15 * 60 * 1000),
                merchantInfo,
                escrowTxHash: receipt.transactionHash,
            }

            setOrders(prev => [...prev, order])

            return order
        } catch (error) {
            console.error('Failed to create sell order:', error)
            return null
        } finally {
            setIsProcessing(false)
        }
    }

    /**
     * Confirm payment sent (buyer confirms they sent fiat)
     */
    const confirmPaymentSent = async (orderId: string): Promise<boolean> => {
        setIsProcessing(true)
        try {
            setOrders(prev => prev.map(order =>
                order.id === orderId
                    ? { ...order, status: 'payment_sent' as const }
                    : order
            ))

            console.log('[BNB] Payment sent confirmed:', orderId)
            return true
        } catch (error) {
            console.error('Failed to confirm payment:', error)
            return false
        } finally {
            setIsProcessing(false)
        }
    }

    /**
     * Confirm payment received (seller confirms they received fiat)
     * Releases USDC from escrow to buyer
     */
    const confirmPaymentReceived = async (orderId: string): Promise<boolean> => {
        if (!account) return false

        setIsProcessing(true)
        try {
            const orderIdBytes = orderIdToBytes32(orderId)

            // Call releaseEscrow on BNB
            console.log('[BNB] Releasing escrow...')
            const escrowContract = getEscrowContract()

            const tx = prepareContractCall({
                contract: escrowContract,
                method: "releaseEscrow",
                params: [orderIdBytes],
            })

            const result = await sendTransaction({
                transaction: tx,
                account,
            })

            const receipt = await waitForReceipt({
                client: thirdwebClient,
                chain: defaultChain,
                transactionHash: result.transactionHash,
            })

            console.log('[BNB] Escrow released:', receipt.transactionHash)

            setOrders(prev => prev.map(order =>
                order.id === orderId
                    ? { ...order, status: 'completed' as const, releaseTxHash: receipt.transactionHash }
                    : order
            ))

            return true
        } catch (error) {
            console.error('Failed to release escrow:', error)
            return false
        } finally {
            setIsProcessing(false)
        }
    }

    /**
     * Cancel order (refund escrow)
     */
    const cancelOrder = async (orderId: string): Promise<boolean> => {
        if (!account) return false

        setIsProcessing(true)
        try {
            const order = orders.find(o => o.id === orderId)

            // Only refund if there's an escrow
            if (order?.escrowTxHash) {
                const orderIdBytes = orderIdToBytes32(orderId)
                const escrowContract = getEscrowContract()

                const tx = prepareContractCall({
                    contract: escrowContract,
                    method: "refundEscrow",
                    params: [orderIdBytes],
                })

                const result = await sendTransaction({
                    transaction: tx,
                    account,
                })

                const receipt = await waitForReceipt({
                    client: thirdwebClient,
                    chain: defaultChain,
                    transactionHash: result.transactionHash,
                })

                console.log('[BNB] Escrow refunded:', receipt.transactionHash)
            }

            setOrders(prev => prev.map(order =>
                order.id === orderId
                    ? { ...order, status: 'cancelled' as const }
                    : order
            ))

            return true
        } catch (error) {
            console.error('Failed to cancel order:', error)
            return false
        } finally {
            setIsProcessing(false)
        }
    }

    /**
     * Raise dispute
     */
    const raiseDispute = async (orderId: string, reason: string): Promise<boolean> => {
        if (!account) return false

        setIsProcessing(true)
        try {
            const orderIdBytes = orderIdToBytes32(orderId)
            const escrowContract = getEscrowContract()

            const tx = prepareContractCall({
                contract: escrowContract,
                method: "raiseDispute",
                params: [orderIdBytes, reason],
            })

            const result = await sendTransaction({
                transaction: tx,
                account,
            })

            const receipt = await waitForReceipt({
                client: thirdwebClient,
                chain: defaultChain,
                transactionHash: result.transactionHash,
            })

            console.log('[BNB] Dispute raised:', receipt.transactionHash)

            setOrders(prev => prev.map(order =>
                order.id === orderId
                    ? { ...order, status: 'disputed' as const }
                    : order
            ))

            return true
        } catch (error) {
            console.error('Failed to raise dispute:', error)
            return false
        } finally {
            setIsProcessing(false)
        }
    }

    /**
     * Get user's orders
     */
    const getUserOrders = () => {
        if (!address) return []
        return orders.filter(order =>
            order.buyer.toLowerCase() === address.toLowerCase() ||
            order.seller.toLowerCase() === address.toLowerCase()
        )
    }

    /**
     * Get specific order
     */
    const getOrder = (orderId: string) => {
        return orders.find(order => order.id === orderId)
    }

    return {
        // Order creation
        createBuyOrder,
        createSellOrder,

        // Order actions
        confirmPaymentSent,
        confirmPaymentReceived,
        cancelOrder,
        raiseDispute,

        // Order queries
        getUserOrders,
        getOrder,
        orders,

        // Utilities
        approveUsdc,

        // State
        isProcessing,
    }
}
