"use client"

import { createThirdwebClient, defineChain } from "thirdweb"

/**
 * Thirdweb Client Configuration
 * Get your client ID from https://thirdweb.com/dashboard
 */
export const thirdwebClient = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
})

// =============================================================================
// CURRENT: opBNB Testnet. defaultChain = opbnbTestnetChain below.
// opBNB Mainnet and BSC chains are commented for alternate use.
// =============================================================================

/**
 * opBNB Testnet — active (current deployment)
 */
export const opbnbTestnetChain = defineChain({
    id: 5611,
    name: 'opBNB Testnet',
    nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    rpc: 'https://opbnb-testnet-rpc.publicnode.com',
    testnet: true,
})

/*
// opBNB Mainnet — uncomment when switching app to mainnet
export const opbnbMainnetChain = defineChain({
    id: 204,
    name: 'opBNB',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpc: 'https://opbnb-mainnet-rpc.bnbchain.org',
    testnet: false,
})

// BSC Testnet — uncomment for BSC testnet
export const bscTestnetChain = defineChain({
    id: 97,
    name: 'BSC Testnet',
    nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    testnet: true,
})

// BSC Mainnet — uncomment for BSC mainnet
export const bscMainnetChain = defineChain({
    id: 56,
    name: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpc: 'https://bsc-dataseed.binance.org',
    testnet: false,
})
*/

/** Default chain used by the app — opBNB Testnet */
export const defaultChain = opbnbTestnetChain

export const SPENDING_CAP = {
    DEFAULT_AMOUNT: 150,
    MAX_AMOUNT: 1000,
    CURRENCY: "USDC",
} as const

export const WALLET_CONFIG = {
    AUTH_OPTIONS: ["email", "google", "apple", "phone"] as const,
    DEFAULT_CHAIN: defaultChain,
    SESSION_DURATION: 30 * 24 * 60 * 60 * 1000,
} as const
