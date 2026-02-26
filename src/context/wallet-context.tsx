"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react"
import { useActiveAccount, useConnect, useDisconnect } from "thirdweb/react"
import { getContract, readContract } from "thirdweb"
import { inAppWallet } from "thirdweb/wallets"
import { thirdwebClient, defaultChain } from "@/lib/thirdweb-config"

// USDC on BNB Chain - set in .env
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x0000000000000000000000000000000000000000'

// USDC ABI for balance fetching
const USDC_BALANCE_ABI = [
    {
        inputs: [{ name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
    }
] as const

/**
 * Wallet Context - PURE Thirdweb Integration
 * 
 * NO fake data. NO random addresses. NO mock balances.
 * Everything comes from Thirdweb embedded wallet.
 * 
 * Flow:
 * 1. User signs up via Google/Apple/Email through Thirdweb
 * 2. Thirdweb creates an embedded wallet for them
 * 3. We use THAT wallet address (from useActiveAccount)
 * 4. Balance is fetched from USDC contract on BNB chain
 * 5. Wallet address is the user's identity
 */

interface WalletState {
    address: string | null           // From Thirdweb ONLY
    isConnected: boolean
    balance: number                  // From BNB chain
    isLoading: boolean
    isBalanceLoading: boolean
    isFirstTimeUser: boolean         // True if this is user's first login
}

interface WalletContextType extends WalletState {
    connect: (method: "google" | "apple" | "email", email?: string) => Promise<boolean>
    disconnect: () => void
    refreshBalance: () => Promise<void>
    markOnboardingComplete: () => void
}

const WalletContext = createContext<WalletContextType | null>(null)

// Helper to check if user has completed onboarding
const ONBOARDING_KEY_PREFIX = 'uwu_onboarded_'
const hasCompletedOnboarding = (address: string): boolean => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(`${ONBOARDING_KEY_PREFIX}${address.toLowerCase()}`) === 'true'
}

const setOnboardingComplete = (address: string) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`${ONBOARDING_KEY_PREFIX}${address.toLowerCase()}`, 'true')
}

// Check if ANY user has onboarded before (not wallet-specific)
function hasAnyPreviousSession(): boolean {
    if (typeof window === 'undefined') return false
    try {
        return Object.keys(localStorage).some(key => key.startsWith(ONBOARDING_KEY_PREFIX))
    } catch {
        return false
    }
}

export function WalletProvider({ children }: { children: ReactNode }) {
    // Thirdweb hooks - these are the ONLY source of truth
    const account = useActiveAccount()
    const { connect: thirdwebConnect } = useConnect()
    const { disconnect: thirdwebDisconnect } = useDisconnect()

    // Track whether Thirdweb has had enough time to auto-reconnect
    const reconnectGraceExpired = useRef(false)

    // Only returning users need to wait for reconnect — new users get instant redirect
    const isReturningUser = useRef(hasAnyPreviousSession())

    const [state, setState] = useState<WalletState>({
        address: null,
        isConnected: false,
        balance: 0,
        // New users: isLoading=false immediately so RouteGuard redirects to onboarding instantly
        // Returning users: isLoading=true, wait for Thirdweb auto-reconnect
        isLoading: hasAnyPreviousSession(),
        isBalanceLoading: false,
        isFirstTimeUser: false,
    })

    // Grace period: keep isLoading=true for up to 3s to allow Thirdweb auto-reconnect
    // ONLY applies to returning users — new users skip this entirely
    useEffect(() => {
        if (!isReturningUser.current) {
            reconnectGraceExpired.current = true
            return
        }

        const timer = setTimeout(() => {
            reconnectGraceExpired.current = true
            setState(prev => {
                if (!prev.isConnected && prev.isLoading) {
                    if (process.env.NODE_ENV === 'development') {
                        console.debug('[Wallet] Reconnect grace period expired')
                    }
                    return { ...prev, isLoading: false }
                }
                return prev
            })
        }, 1500)
        return () => clearTimeout(timer)
    }, [])

    // Clean up ALL old localStorage garbage
    useEffect(() => {
        localStorage.removeItem('uwu_wallet')
        localStorage.removeItem('uwu_balance')
    }, [])

    // Fetch USDC balance from contract
    const fetchUsdcBalance = useCallback(async (address: string) => {
        try {
            const usdcContract = getContract({
                client: thirdwebClient,
                chain: defaultChain,
                address: USDC_ADDRESS,
                abi: USDC_BALANCE_ABI,
            })

            const balanceRaw = await readContract({
                contract: usdcContract,
                method: "balanceOf",
                params: [address],
            }) as bigint

            // USDC has 6 decimals
            const balance = Number(balanceRaw) / 1_000_000
            console.log('[Wallet] USDC Balance from contract:', balance)
            return balance
        } catch (error) {
            console.error('[Wallet] Failed to fetch USDC balance:', error)
            return 0
        }
    }, [])

    // Sync with Thirdweb account - this is the ONLY place we set address
    useEffect(() => {
        if (account?.address) {
            console.log('[Wallet] Connected via Thirdweb:', account.address)
            const isFirstTime = !hasCompletedOnboarding(account.address)
            console.log('[Wallet] First time user:', isFirstTime)

            // If user already connected before (has a wallet), auto-mark onboarding done
            // This handles re-login from different browsers — Thirdweb gives the same
            // embedded wallet, so having a wallet at all means they're not new.
            if (isFirstTime) {
                // Check if this wallet has any on-chain history (balance > 0)
                // If so, they're a returning user who just hasn't used this browser before
                // For now, mark complete immediately since Thirdweb SSO = same user
                setOnboardingComplete(account.address)
            }

            setState(prev => ({
                ...prev,
                address: account.address,
                isConnected: true,
                isLoading: false,
                isFirstTimeUser: false, // Always false — we auto-complete onboarding
            }))

            // Fetch balance immediately on connect
            setState(prev => ({ ...prev, isBalanceLoading: true }))
            fetchUsdcBalance(account.address).then(balance => {
                setState(prev => ({ ...prev, balance, isBalanceLoading: false }))
            })
        } else {
            setState(prev => ({
                ...prev,
                address: null,
                isConnected: false,
                balance: 0,
                isBalanceLoading: false,
                isFirstTimeUser: false,
                isLoading: reconnectGraceExpired.current ? false : prev.isLoading,
            }))
        }
    }, [account?.address, fetchUsdcBalance])

    // Connect via Thirdweb embedded wallet
    const connect = useCallback(async (method: "google" | "apple" | "email", email?: string): Promise<boolean> => {
        setState(prev => ({ ...prev, isLoading: true }))

        try {
            const wallet = inAppWallet()

            if (method === "google") {
                await thirdwebConnect(async () => {
                    await wallet.connect({
                        client: thirdwebClient,
                        chain: defaultChain,
                        strategy: "google",
                    })
                    return wallet
                })
            } else if (method === "apple") {
                await thirdwebConnect(async () => {
                    await wallet.connect({
                        client: thirdwebClient,
                        chain: defaultChain,
                        strategy: "apple",
                    })
                    return wallet
                })
            }
            // Email auth removed - requires OTP flow, use Google or Apple

            // Address will be set by the useEffect watching account.address
            return true
        } catch (error) {
            console.error("[Wallet] Connection failed:", error)
            setState(prev => ({ ...prev, isLoading: false }))
            return false
        }
    }, [thirdwebConnect])

    // Disconnect
    const disconnect = useCallback(() => {
        thirdwebDisconnect(inAppWallet())
        // Clear LP active status on logout
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('lp_active_status')
        }
        setState({
            address: null,
            isConnected: false,
            balance: 0,
            isLoading: false,
            isBalanceLoading: false,
            isFirstTimeUser: false,
        })
    }, [thirdwebDisconnect])

    // Refresh balance from chain
    const refreshBalance = useCallback(async () => {
        if (!state.address) return
        setState(prev => ({ ...prev, isBalanceLoading: true }))
        const balance = await fetchUsdcBalance(state.address)
        setState(prev => ({ ...prev, balance, isBalanceLoading: false }))
    }, [state.address, fetchUsdcBalance])

    // Mark onboarding as complete for this wallet
    const markOnboardingComplete = useCallback(() => {
        if (state.address) {
            setOnboardingComplete(state.address)
            setState(prev => ({ ...prev, isFirstTimeUser: false }))
            console.log('[Wallet] Onboarding marked complete for:', state.address)
        }
    }, [state.address])

    return (
        <WalletContext.Provider
            value={{
                ...state,
                connect,
                disconnect,
                refreshBalance,
                markOnboardingComplete,
            }}
        >
            {children}
        </WalletContext.Provider>
    )
}

export function useWalletContext() {
    const context = useContext(WalletContext)
    if (!context) {
        throw new Error("useWalletContext must be used within WalletProvider")
    }
    return context
}
