"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Home, Shield, Wallet, QrCode } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Bottom navigation: Home, Validate, Profile only.
 */
export function BottomNav() {
    const pathname = usePathname()

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0f] border-t border-[#1a1a24] safe-area-bottom pb-2">
            <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2 relative">
                <Link
                    href="/dashboard"
                    className={cn(
                        "flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        pathname === "/dashboard"
                            ? "text-[#3b82f6]"
                            : "text-[#8b8b9e] hover:text-white"
                    )}
                >
                    <Home className="w-5 h-5 mb-1" />
                    Home
                </Link>

                <Link
                    href="/wallet"
                    className={cn(
                        "flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        pathname === "/wallet"
                            ? "text-[#3b82f6]"
                            : "text-[#8b8b9e] hover:text-white"
                    )}
                >
                    <Wallet className="w-5 h-5 mb-1" />
                    Wallet
                </Link>

                <div className="flex flex-col items-center justify-center -mt-6">
                    <Link
                        href="/scan"
                        className="bg-[#1a1a24] border-2 border-[#3b82f6] text-[#3b82f6] p-3 rounded-2xl shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:bg-[#3b82f6] hover:text-white transition-all transform hover:scale-105"
                    >
                        <QrCode className="w-6 h-6" />
                    </Link>
                    <span className="text-[10px] font-medium text-[#3b82f6] mt-1">Scan</span>
                </div>

                <Link
                    href="/dao"
                    className={cn(
                        "flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        pathname === "/dao"
                            ? "text-[#22c55e]"
                            : "text-[#8b8b9e] hover:text-white"
                    )}
                >
                    <Shield className="w-5 h-5 mb-1" />
                    Validate
                </Link>

                <Link
                    href="/profile"
                    className={cn(
                        "flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                        pathname === "/profile"
                            ? "text-[#3b82f6]"
                            : "text-[#8b8b9e] hover:text-white"
                    )}
                >
                    <User className="w-5 h-5 mb-1" />
                    Profile
                </Link>
            </div>
        </div>
    )
}
