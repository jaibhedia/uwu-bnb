"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    ArrowLeftRight,
    ClipboardList,
    Gift,
    LogOut,
} from "lucide-react"

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/trade", icon: ArrowLeftRight, label: "Trade" },
    { href: "/orders", icon: ClipboardList, label: "Orders" },
    { href: "/rewards", icon: Gift, label: "Rewards" },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="fixed left-0 top-0 h-screen w-56 bg-[#09090b] border-r border-zinc-800 flex flex-col">
            {/* Logo */}
            <div className="h-14 flex items-center px-5 border-b border-zinc-800">
                <Link href="/" className="text-lg font-semibold text-white">
                    uWu
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-zinc-800 text-white"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Wallet */}
            <div className="p-3 border-t border-zinc-800">
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50">
                    <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate font-mono">0x1234...abcd</p>
                        <p className="text-[10px] text-zinc-500">Base</p>
                    </div>
                </div>
            </div>

            {/* Disconnect */}
            <div className="p-3 border-t border-zinc-800">
                <button className="flex items-center gap-3 px-3 py-2 text-zinc-500 hover:text-red-400 text-sm w-full transition-colors">
                    <LogOut className="w-4 h-4" />
                    <span>Disconnect</span>
                </button>
            </div>
        </aside>
    )
}
