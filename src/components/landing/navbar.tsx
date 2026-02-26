"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { QrCode, Coins, Scale } from "lucide-react"
import { useWallet } from "@/hooks/useWallet"

export function Navbar() {
    const { isConnected, isFirstTimeUser } = useWallet()

    // If connected, go to scan. Otherwise go to onboarding first
    const launchHref = isConnected ? '/scan' : '/onboarding'
    const launchText = isConnected ? 'Open App' : 'Launch App'

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 max-w-7xl mx-auto backdrop-blur-md bg-[#030304]/80 border-b border-white/5">
            <Link href="/" className="flex items-center gap-3 cursor-pointer group">
                <span className="text-2xl font-bold text-white tracking-tighter hover:text-[#F0B90B] transition-colors">uWu</span>
            </Link>

            <div className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-400">
                <Link href="/scan" className="px-4 py-2 rounded-full border border-transparent hover:border-white/10 hover:bg-white/5 hover:text-white transition-all">
                    Scan & Pay
                </Link>
                <Link href="/lp/register" className="px-4 py-2 rounded-full border border-transparent hover:border-white/10 hover:bg-white/5 hover:text-white transition-all">
                    Liquidity Providers
                </Link>
                <Link href="/dao" className="px-4 py-2 rounded-full border border-transparent hover:border-white/10 hover:bg-white/5 hover:text-white transition-all">
                    DAO
                </Link>
            </div>

            <Link
                href={launchHref}
                className="px-6 py-2.5 bg-[#F0B90B] text-black text-sm font-semibold rounded-lg hover:bg-[#D4A50A] transition-all shadow-lg shadow-[#F0B90B]/20"
            >
                {launchText}
            </Link>
        </nav>
    )
}
