"use client"

import { ReactNode } from "react"
import { ThirdwebProvider as ThirdwebSDKProvider } from "thirdweb/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Create React Query client
const queryClient = new QueryClient()

interface ThirdwebProviderProps {
    children: ReactNode
}

/**
 * Thirdweb Provider Component
 * 
 * Wraps the app with Thirdweb SDK provider for:
 * - Embedded wallet creation (custodial, no browser extension needed)
 * - Pre-approved spending caps
 * - Social login (email, Google, Apple)
 * - opBNB Testnet integration
 */
export function ThirdwebProvider({ children }: ThirdwebProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <ThirdwebSDKProvider>
                {children}
            </ThirdwebSDKProvider>
        </QueryClientProvider>
    )
}
