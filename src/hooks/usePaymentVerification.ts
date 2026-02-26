"use client"

import { useState, useCallback } from 'react'
import { keccak256, toHex, stringToBytes } from 'viem'
import { PLATFORM_CONFIG } from '@/lib/platform-config'

/**
 * Payment Verification Hook
 * Multi-layer verification for UPI payments
 */

export interface PaymentProof {
    orderId: string
    utr: string              // 12-digit UTR number
    amount: number           // Amount in fiat (INR)
    timestamp: number        // Payment timestamp
    screenshot?: string      // Base64 encoded screenshot
    senderName?: string      // Name on bank statement
}

export interface VerificationResult {
    verified: boolean
    confidence: number       // 0-100
    autoRelease: boolean     // True if confidence > 85
    requiresReview: boolean  // True if 70-85
    disputeCreated: boolean  // True if < 70
    method: 'hash' | 'ocr' | 'api' | 'combined'
    utrHash?: string
    evidenceIPFS?: string
}

export function usePaymentVerification() {
    const [isVerifying, setIsVerifying] = useState(false)
    const [lastResult, setLastResult] = useState<VerificationResult | null>(null)

    /**
     * Generate cryptographic hash of UTR + amount + timestamp
     * This hash is stored on-chain for dispute reference
     */
    const generateUTRHash = useCallback((utr: string, amount: number, timestamp: number): string => {
        const data = `${utr}:${amount}:${timestamp}`
        const hash = keccak256(stringToBytes(data))
        return hash
    }, [])

    /**
     * Validate UTR format (12 digits for UPI)
     */
    const validateUTR = useCallback((utr: string): boolean => {
        // UPI UTR is typically 12 digits
        const cleanUtr = utr.replace(/\s/g, '')
        return /^\d{12}$/.test(cleanUtr)
    }, [])

    /**
     * Layer 1: UTR Hash Verification (Instant)
     * Verifies format and generates on-chain hash
     */
    const verifyUTRHash = useCallback(async (
        utr: string,
        amount: number,
        timestamp: number
    ): Promise<{ verified: boolean; confidence: number; hash: string }> => {
        // Validate UTR format
        if (!validateUTR(utr)) {
            return { verified: false, confidence: 0, hash: '' }
        }

        // Generate hash
        const hash = generateUTRHash(utr, amount, timestamp)

        // Basic verification passed
        return {
            verified: true,
            confidence: 15, // Hash alone gives 15% confidence
            hash,
        }
    }, [validateUTR, generateUTRHash])

    /**
     * Layer 2: Screenshot OCR Verification (2-5 min)
     * Extracts and validates payment details from screenshot
     */
    const verifyScreenshot = useCallback(async (
        screenshot: string,
        expectedAmount: number,
        expectedUtr: string
    ): Promise<{ verified: boolean; confidence: number; extractedData?: object }> => {
        try {
            const response = await fetch('/api/ocr/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: screenshot,
                    expectedAmount,
                    expectedUtr,
                }),
            })

            if (!response.ok) {
                // OCR service not available, but not a failure
                return { verified: false, confidence: 0 }
            }

            const data = await response.json()

            if (data.success && data.verified) {
                return {
                    verified: true,
                    confidence: 25, // Screenshot verification adds 25%
                    extractedData: data.extractedData,
                }
            }

            return { verified: false, confidence: 0 }
        } catch (error) {
            console.log('[Verification] OCR not available, skipping:', error)
            return { verified: false, confidence: 0 }
        }
    }, [])

    /**
     * Layer 3: Payment API Verification (Real-time)
     * Check with bank/payment gateway (future enhancement)
     */
    const verifyViaPaymentAPI = useCallback(async (
        utr: string
    ): Promise<{ verified: boolean; confidence: number }> => {
        try {
            const response = await fetch(`/api/payment-gateway/verify/${utr}`)

            if (!response.ok) {
                // Payment API not available
                return { verified: false, confidence: 0 }
            }

            const data = await response.json()

            if (data.success && data.verified) {
                return {
                    verified: true,
                    confidence: 60, // API verification adds 60%
                }
            }

            return { verified: false, confidence: 0 }
        } catch (error) {
            console.log('[Verification] Payment API not available, skipping:', error)
            return { verified: false, confidence: 0 }
        }
    }, [])

    /**
     * Combined verification with confidence scoring
     * Runs all available verification layers in parallel
     */
    const verifyPayment = useCallback(async (proof: PaymentProof): Promise<VerificationResult> => {
        setIsVerifying(true)

        try {
            let totalConfidence = 0

            // Run all verification methods in parallel
            const [hashResult, ocrResult, apiResult] = await Promise.allSettled([
                verifyUTRHash(proof.utr, proof.amount, proof.timestamp),
                proof.screenshot
                    ? verifyScreenshot(proof.screenshot, proof.amount, proof.utr)
                    : Promise.resolve({ verified: false, confidence: 0 }),
                verifyViaPaymentAPI(proof.utr),
            ])

            // Aggregate confidence scores
            if (hashResult.status === 'fulfilled' && hashResult.value.verified) {
                totalConfidence += hashResult.value.confidence
            }

            if (ocrResult.status === 'fulfilled' && ocrResult.value.verified) {
                totalConfidence += ocrResult.value.confidence
            }

            if (apiResult.status === 'fulfilled' && apiResult.value.verified) {
                totalConfidence += apiResult.value.confidence
            }

            // Determine thresholds
            const { verification } = PLATFORM_CONFIG
            const autoRelease = totalConfidence >= verification.autoReleaseThreshold
            const requiresReview = totalConfidence >= verification.manualReviewThreshold && !autoRelease
            const disputeCreated = totalConfidence < verification.manualReviewThreshold

            // Store verification on-chain via API
            let evidenceIPFS: string | undefined
            if (proof.screenshot) {
                try {
                    const uploadResponse = await fetch('/api/ipfs/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            data: proof.screenshot,
                            type: 'payment-proof',
                            orderId: proof.orderId,
                        }),
                    })

                    if (uploadResponse.ok) {
                        const uploadData = await uploadResponse.json()
                        evidenceIPFS = uploadData.ipfsHash
                    }
                } catch (e) {
                    console.log('[Verification] IPFS upload failed, continuing:', e)
                }
            }

            const result: VerificationResult = {
                verified: totalConfidence >= verification.manualReviewThreshold,
                confidence: totalConfidence,
                autoRelease,
                requiresReview,
                disputeCreated,
                method: 'combined',
                utrHash: hashResult.status === 'fulfilled' ? hashResult.value.hash : undefined,
                evidenceIPFS,
            }

            setLastResult(result)

            // Submit verification result to API
            await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: proof.orderId,
                    utr: proof.utr,
                    timestamp: proof.timestamp,
                    result,
                }),
            })

            return result
        } catch (error) {
            console.error('[Verification] Failed:', error)
            throw error
        } finally {
            setIsVerifying(false)
        }
    }, [verifyUTRHash, verifyScreenshot, verifyViaPaymentAPI])

    /**
     * Quick UTR validation for UI feedback
     */
    const quickValidateUTR = useCallback((utr: string): {
        valid: boolean
        message: string
    } => {
        const cleanUtr = utr.replace(/\s/g, '')

        if (cleanUtr.length === 0) {
            return { valid: false, message: 'Enter UTR number' }
        }

        if (!/^\d+$/.test(cleanUtr)) {
            return { valid: false, message: 'UTR must contain only digits' }
        }

        if (cleanUtr.length < 12) {
            return { valid: false, message: `UTR must be 12 digits (${cleanUtr.length}/12)` }
        }

        if (cleanUtr.length > 12) {
            return { valid: false, message: 'UTR must be exactly 12 digits' }
        }

        return { valid: true, message: 'Valid UTR format' }
    }, [])

    return {
        // Verification methods
        verifyPayment,
        verifyUTRHash,
        quickValidateUTR,

        // Utilities
        generateUTRHash,
        validateUTR,

        // State
        isVerifying,
        lastResult,
    }
}
