import { defineChain } from 'viem'

// =============================================================================
// CURRENT: opBNB Testnet. App uses defaultChain = opbnbTestnet below.
// opBNB Mainnet and BSC (testnet/mainnet) are commented for alternate use.
// =============================================================================

/**
 * opBNB Testnet — active (current deployment)
 */
export const opbnbTestnet = defineChain({
    id: 5611,
    name: 'opBNB Testnet',
    network: 'opbnb-testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'tBNB',
        symbol: 'tBNB',
    },
    rpcUrls: {
        default: { http: ['https://opbnb-testnet-rpc.publicnode.com'] },
        public: { http: ['https://opbnb-testnet-rpc.publicnode.com'] },
    },
    blockExplorers: {
        default: { name: 'opBNB Testnet Explorer', url: 'https://opbnb-testnet.bscscan.com' },
    },
    testnet: true,
})

/*
// opBNB Mainnet — uncomment when switching app to mainnet
export const opbnbMainnet = defineChain({
    id: 204,
    name: 'opBNB',
    network: 'opbnb-mainnet',
    nativeCurrency: { decimals: 18, name: 'BNB', symbol: 'BNB' },
    rpcUrls: {
        default: { http: ['https://opbnb-mainnet-rpc.bnbchain.org'] },
        public: { http: ['https://opbnb-mainnet-rpc.bnbchain.org'] },
    },
    blockExplorers: {
        default: { name: 'opBNB Explorer', url: 'https://opbnb.bscscan.com' },
    },
    testnet: false,
})

// BSC Testnet — uncomment for BSC testnet deployment
export const bscTestnet = defineChain({
    id: 97,
    name: 'BSC Testnet',
    network: 'bsc-testnet',
    nativeCurrency: { decimals: 18, name: 'tBNB', symbol: 'tBNB' },
    rpcUrls: {
        default: { http: ['https://data-seed-prebsc-1-s1.binance.org:8545'] },
        public: { http: ['https://data-seed-prebsc-1-s1.binance.org:8545'] },
    },
    blockExplorers: {
        default: { name: 'BSC Testnet Explorer', url: 'https://testnet.bscscan.com' },
    },
    testnet: true,
})

// BSC Mainnet — uncomment for BSC mainnet deployment
export const bscMainnet = defineChain({
    id: 56,
    name: 'BNB Smart Chain',
    network: 'bsc-mainnet',
    nativeCurrency: { decimals: 18, name: 'BNB', symbol: 'BNB' },
    rpcUrls: {
        default: { http: ['https://bsc-dataseed.binance.org'] },
        public: { http: ['https://bsc-dataseed.binance.org'] },
    },
    blockExplorers: {
        default: { name: 'BscScan', url: 'https://bscscan.com' },
    },
    testnet: false,
})
*/

/**
 * Default chain for app — opBNB Testnet (change to opbnbMainnet / bscTestnet / bscMainnet when needed)
 */
export const defaultChain = opbnbTestnet

export const CONTRACT_ADDRESSES = {
    P2P_ESCROW: process.env.NEXT_PUBLIC_P2P_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000',
    DISPUTE_DAO: process.env.NEXT_PUBLIC_DISPUTE_DAO_ADDRESS || '0x0000000000000000000000000000000000000000',
    TRUST_SCORE: process.env.NEXT_PUBLIC_TRUST_SCORE_ADDRESS || '0x0000000000000000000000000000000000000000',
    LIQUIDITY_POOL: '0x0000000000000000000000000000000000000000',
} as const

export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x0000000000000000000000000000000000000000'

export const SUPPORTED_CURRENCIES = [
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
] as const

export const PLATFORM_CONFIG = {
    MERCHANT_MIN_STAKE: 500,
    MERCHANT_FEE_PERCENTAGE: 2,
    ORDER_TIMEOUT_MINUTES: 15,
    MIN_TRANSACTION_AMOUNT: 0,
    SMALL_ORDER_FEE: 0.125,
    SMALL_ORDER_THRESHOLD: 10,
    MAX_TRANSACTION_AMOUNT: 10000,
} as const
