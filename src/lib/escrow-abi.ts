/**
 * P2P Escrow Contract ABI for BNB Chain (V5)
 * 
 * Fully decentralized escrow for P2P transactions.
 * No KYC - permissionless platform.
 * 
 * Functions:
 * - createEscrow: Lock USDC in escrow for an order
 * - releaseEscrow: Release USDC to recipient
 * - refundEscrow: Refund USDC to sender
 * - getEscrow: View escrow details
 * - lpStakes: Get LP stake profile
 */

export const P2P_ESCROW_ABI = [
    {
        "inputs": [{ "name": "", "type": "address" }],
        "name": "lpStakes",
        "outputs": [
            { "name": "amount", "type": "uint256" },
            { "name": "lockedInOrders", "type": "uint256" },
            { "name": "totalTrades", "type": "uint256" },
            { "name": "totalDisputes", "type": "uint256" },
            { "name": "disputesLost", "type": "uint256" },
            { "name": "memberSince", "type": "uint256" },
            { "name": "avgCompletionTime", "type": "uint256" },
            { "name": "cooldownUntil", "type": "uint256" },
            { "name": "isActive", "type": "bool" },
            { "name": "isBanned", "type": "bool" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "orderId", "type": "bytes32" },
            { "name": "amount", "type": "uint256" },
            { "name": "recipient", "type": "address" },
            { "name": "lp", "type": "address" },
            { "name": "expiresAt", "type": "uint256" }
        ],
        "name": "createEscrow",
        "outputs": [{ "name": "", "type": "bytes32" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "orderId", "type": "bytes32" }
        ],
        "name": "releaseEscrow",
        "outputs": [{ "name": "success", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "orderId", "type": "bytes32" }
        ],
        "name": "refundEscrow",
        "outputs": [{ "name": "success", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "orderId", "type": "bytes32" }
        ],
        "name": "getEscrow",
        "outputs": [
            { "name": "sender", "type": "address" },
            { "name": "recipient", "type": "address" },
            { "name": "amount", "type": "uint256" },
            { "name": "status", "type": "uint8" },
            { "name": "createdAt", "type": "uint256" },
            { "name": "expiresAt", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "orderId", "type": "bytes32" },
            { "name": "reason", "type": "string" }
        ],
        "name": "raiseDispute",
        "outputs": [{ "name": "disputeId", "type": "bytes32" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "orderId", "type": "bytes32" },
            { "indexed": true, "name": "sender", "type": "address" },
            { "indexed": false, "name": "amount", "type": "uint256" }
        ],
        "name": "EscrowCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "orderId", "type": "bytes32" },
            { "indexed": true, "name": "recipient", "type": "address" },
            { "indexed": false, "name": "amount", "type": "uint256" }
        ],
        "name": "EscrowReleased",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "orderId", "type": "bytes32" },
            { "indexed": true, "name": "sender", "type": "address" },
            { "indexed": false, "name": "amount", "type": "uint256" }
        ],
        "name": "EscrowRefunded",
        "type": "event"
    }
] as const

/**
 * ERC20 USDC Token ABI (for approvals)
 */
export const USDC_ABI = [
    {
        "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "owner", "type": "address" },
            { "name": "spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "account", "type": "address" }
        ],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const

/**
 * Escrow Status Enum
 */
export enum EscrowStatus {
    NONE = 0,
    PENDING = 1,
    LOCKED = 2,
    RELEASED = 3,
    REFUNDED = 4,
    DISPUTED = 5
}

/**
 * Helper to convert order ID string to bytes32
 */
export function orderIdToBytes32(orderId: string): `0x${string}` {
    // Hash the order ID to get a consistent bytes32
    const encoder = new TextEncoder()
    const data = encoder.encode(orderId)
    let hash = BigInt(0)
    for (const byte of data) {
        hash = (hash << BigInt(8)) + BigInt(byte)
    }
    return `0x${hash.toString(16).padStart(64, '0')}` as `0x${string}`
}

/**
 * Parse USDC amount (6 decimals)
 * Uses Math.round to avoid floating-point precision loss
 */
export function parseUsdc(amount: number): bigint {
    return BigInt(Math.round(amount * 1_000_000))
}

/**
 * Format USDC amount from chain (6 decimals)
 */
export function formatUsdc(amount: bigint): number {
    return Number(amount) / 1_000_000
}
