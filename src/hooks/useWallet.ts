"use client"

import { useWalletContext } from "@/context/wallet-context"

/**
 * useWallet hook - Pure Thirdweb wallet integration on opBNB Testnet
 * 
 * Address and balance come from Thirdweb/chain only.
 * Display name: short address.
 */
export function useWallet() {
    const context = useWalletContext()

    // Display name: short address only (no ENS on opBNB)
    const displayName = context.address
        ? `${context.address.slice(0, 6)}...${context.address.slice(-4)}`
        : null

    return {
        // State - ALL from Thirdweb
        address: context.address,
        isConnected: context.isConnected,
        balance: context.balance,
        balanceFormatted: context.balance.toFixed(2),
        isLoading: context.isLoading,
        isBalanceLoading: context.isBalanceLoading,
        isFirstTimeUser: context.isFirstTimeUser,

        // Names
        uwuName: null as string | null,
        ethName: null as string | null,
        displayName,

        // Actions
        connect: context.connect,
        disconnect: context.disconnect,
        refreshBalance: context.refreshBalance,
        markOnboardingComplete: context.markOnboardingComplete,

        // Computed
        shortAddress: context.address
            ? `${context.address.slice(0, 6)}...${context.address.slice(-4)}`
            : null,
    }
}
