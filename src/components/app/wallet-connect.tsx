"use client"

import { useState } from "react"
import { Wallet, LogOut, Loader2, Chrome, Apple } from "lucide-react"
import { useWallet } from "@/hooks/useWallet"

/**
 * WalletConnect Component
 * 
 * Social login with Thirdweb (Google, Apple)
 * Creates embedded wallet on BNB chain
 */
export function WalletConnect() {
    const { isConnected, displayName, balance, connect, disconnect, isLoading } = useWallet()
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectingMethod, setConnectingMethod] = useState<string | null>(null)

    const handleGoogleConnect = async () => {
        setIsConnecting(true)
        setConnectingMethod("google")
        await connect("google")
        setIsConnecting(false)
        setConnectingMethod(null)
    }

    const handleAppleConnect = async () => {
        setIsConnecting(true)
        setConnectingMethod("apple")
        await connect("apple")
        setIsConnecting(false)
        setConnectingMethod(null)
    }

    if (isLoading && isConnected) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-text-secondary">Connecting...</span>
            </div>
        )
    }

    if (isConnected) {
        return (
            <div className="flex items-center gap-3">
                <div className="bg-surface border border-border px-3 py-2">
                    <p className="text-xs text-text-secondary">Balance</p>
                    <p className="text-sm font-bold font-mono text-brand">${balance.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 bg-surface border border-border px-3 py-2">
                    <Wallet className="w-4 h-4 text-brand" />
                    <span className="text-sm font-bold text-brand">{displayName}</span>
                    <button
                        onClick={disconnect}
                        className="ml-2 p-1 hover:bg-error/20 rounded transition-colors"
                        title="Disconnect"
                    >
                        <LogOut className="w-4 h-4 text-error" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Social Login Buttons */}
            <button
                onClick={handleGoogleConnect}
                disabled={isConnecting}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
                {connectingMethod === "google" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <Chrome className="w-5 h-5" />
                )}
                Continue with Google
            </button>

            <button
                onClick={handleAppleConnect}
                disabled={isConnecting}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-black text-white font-bold rounded-lg border border-white/20 hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
                {connectingMethod === "apple" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <Apple className="w-5 h-5" />
                )}
                Continue with Apple
            </button>
        </div>
    )
}

/**
 * Compact wallet button for headers
 */
export function WalletButton() {
    const { isConnected, displayName, connect, isLoading } = useWallet()
    const [isConnecting, setIsConnecting] = useState(false)

    const handleConnect = async () => {
        setIsConnecting(true)
        await connect("google")
        setIsConnecting(false)
    }

    if (isLoading) {
        return (
            <button className="p-2 bg-surface border border-border rounded-lg" disabled>
                <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
            </button>
        )
    }

    if (isConnected) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg">
                <Wallet className="w-4 h-4 text-brand" />
                <span className="text-xs font-bold text-brand">{displayName}</span>
            </div>
        )
    }

    return (
        <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-3 py-2 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50"
        >
            {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Wallet className="w-4 h-4" />
            )}
            Connect
        </button>
    )
}
