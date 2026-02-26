/**
 * UTR Hash Verification Utility
 * 
 * Creates and verifies cryptographic hashes for payment proofs
 * Uses keccak256 (same as Solidity) for on-chain compatibility
 */

import { keccak256, toBytes, encodePacked, toHex, Hex } from 'viem'

/**
 * Payment proof data structure
 */
export interface PaymentProof {
    utr: string           // UTR/Reference number
    amount: number        // Amount in smallest unit (paise for INR)
    timestamp: number     // Unix timestamp
    orderId: string       // Associated order ID
}

/**
 * Generate a payment proof hash
 * This hash is stored on-chain and can be verified later
 * 
 * @param utr - The UTR/Reference number from bank
 * @param amount - Amount in smallest unit (paise)
 * @param timestamp - Unix timestamp
 * @returns bytes32 hash
 */
export function generatePaymentProofHash(
    utr: string,
    amount: number,
    timestamp: number
): Hex {
    // Normalize UTR (remove spaces, uppercase)
    const normalizedUtr = utr.replace(/\s/g, '').toUpperCase()
    
    // Create packed encoding matching Solidity's abi.encodePacked
    const encoded = encodePacked(
        ['string', 'uint256', 'uint256'],
        [normalizedUtr, BigInt(amount), BigInt(timestamp)]
    )
    
    // Hash with keccak256
    return keccak256(encoded)
}

/**
 * Verify a payment proof against a stored hash
 */
export function verifyPaymentProof(
    utr: string,
    amount: number,
    timestamp: number,
    expectedHash: Hex
): boolean {
    const computedHash = generatePaymentProofHash(utr, amount, timestamp)
    return computedHash.toLowerCase() === expectedHash.toLowerCase()
}

/**
 * Generate order-specific payment reference
 * This creates a unique reference that can be included in UPI payments
 */
export function generatePaymentReference(orderId: string): string {
    // Take first 8 chars of keccak256(orderId)
    const hash = keccak256(toBytes(orderId))
    return `UWU${hash.slice(2, 10).toUpperCase()}`
}

/**
 * Validate UTR format
 * Indian bank UTRs typically follow specific patterns
 */
export function validateUtrFormat(utr: string): { valid: boolean; error?: string } {
    const cleanUtr = utr.replace(/\s/g, '')
    
    // UTR should be 12-22 characters
    if (cleanUtr.length < 12) {
        return { valid: false, error: 'UTR is too short (minimum 12 characters)' }
    }
    
    if (cleanUtr.length > 22) {
        return { valid: false, error: 'UTR is too long (maximum 22 characters)' }
    }
    
    // Should be alphanumeric
    if (!/^[A-Za-z0-9]+$/.test(cleanUtr)) {
        return { valid: false, error: 'UTR should contain only letters and numbers' }
    }
    
    return { valid: true }
}

/**
 * Extract UTR from UPI transaction response
 * Different UPI apps format responses differently
 */
export function extractUtrFromUpiResponse(response: string): string | null {
    // Common patterns
    const patterns = [
        /UTR[:\s]*([A-Za-z0-9]{12,22})/i,
        /Reference[:\s]*([A-Za-z0-9]{12,22})/i,
        /Txn[:\s]*ID[:\s]*([A-Za-z0-9]{12,22})/i,
        /([A-Za-z0-9]{16,22})/, // Generic long alphanumeric
    ]
    
    for (const pattern of patterns) {
        const match = response.match(pattern)
        if (match && match[1]) {
            const validation = validateUtrFormat(match[1])
            if (validation.valid) {
                return match[1].toUpperCase()
            }
        }
    }
    
    return null
}

/**
 * Create a signed payment attestation for disputes
 * This can be submitted as evidence in case of disputes
 */
export interface PaymentAttestation {
    proof: PaymentProof
    hash: Hex
    signature?: string  // Optional: signed by user's wallet
}

export function createPaymentAttestation(proof: PaymentProof): PaymentAttestation {
    const hash = generatePaymentProofHash(proof.utr, proof.amount, proof.timestamp)
    
    return {
        proof,
        hash,
    }
}

/**
 * Batch verify multiple payment proofs
 * Useful for dispute resolution
 */
export function batchVerifyProofs(
    proofs: Array<{ proof: PaymentProof; expectedHash: Hex }>
): Array<{ proof: PaymentProof; valid: boolean }> {
    return proofs.map(({ proof, expectedHash }) => ({
        proof,
        valid: verifyPaymentProof(proof.utr, proof.amount, proof.timestamp, expectedHash)
    }))
}

/**
 * Time-based validation
 * Ensures payment timestamp is within acceptable window
 */
export function isPaymentTimestampValid(
    timestamp: number,
    orderCreatedAt: number,
    maxAgeSeconds: number = 1800 // 30 minutes default
): boolean {
    const now = Math.floor(Date.now() / 1000)
    
    // Payment should be after order creation
    if (timestamp < orderCreatedAt) {
        return false
    }
    
    // Payment should be within acceptable window
    if (timestamp > now + 300) { // Allow 5 min clock skew
        return false
    }
    
    // Payment shouldn't be too old
    if (now - timestamp > maxAgeSeconds) {
        return false
    }
    
    return true
}
