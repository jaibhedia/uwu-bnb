"use client"

import { ArrowLeft, TrendingUp, Award, ChevronRight } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

const history = [
    { action: "Completed trade", points: "+5" },
    { action: "Fast payment", points: "+3" },
    { action: "Completed trade", points: "+5" },
]

export default function RewardsPage() {
    return (
        <div className="min-h-screen bg-background text-text-primary max-w-md mx-auto transition-colors duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <Link href="/dashboard" className="p-2 -ml-2 hover:bg-surface rounded-lg transition-colors">
                    <ArrowLeft className="w-5 h-5 text-text-secondary" />
                </Link>
                <div className="flex flex-col items-center">
                    <h1 className="font-bold text-text-primary tracking-tight">STATUS</h1>
                    <span className="text-[10px] text-text-secondary font-mono">REPUTATION & REWARDS</span>
                </div>
                <ThemeToggle />
            </div>

            <div className="px-4 py-4">
                {/* Reputation */}
                <div className="bg-surface border border-border rounded-lg p-6 mb-4 text-center">
                    <div className="w-20 h-20 rounded-full border-4 border-brand mx-auto flex items-center justify-center mb-3">
                        <span className="text-2xl font-bold font-mono text-brand">85</span>
                    </div>
                    <p className="text-text-primary font-bold uppercase tracking-wide">Good Standing</p>
                    <p className="text-xs text-text-secondary font-mono mt-1">Trading Limit: $10,000</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-surface border border-border rounded-lg p-4">
                        <p className="text-xs text-text-secondary font-mono mb-1 uppercase">Total Earned</p>
                        <p className="text-xl font-bold font-mono text-text-primary">$478</p>
                    </div>
                    <div className="bg-surface border border-border rounded-lg p-4">
                        <p className="text-xs text-text-secondary font-mono mb-1 uppercase">Claimable</p>
                        <p className="text-xl font-bold font-mono text-brand">0 USDC</p>
                    </div>
                </div>

                {/* History */}
                <div className="bg-surface border border-border rounded-lg p-4">
                    <h3 className="text-xs font-bold text-text-secondary uppercase mb-3 tracking-wider">Recent Activity</h3>
                    <div className="space-y-3">
                        {history.map((item, i) => (
                            <div key={i} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="w-4 h-4 text-success" />
                                    <span className="text-sm text-text-primary font-mono">{item.action}</span>
                                </div>
                                <span className="text-sm font-bold font-mono text-success">{item.points}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Milestones */}
                <div className="mt-4 bg-surface border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Milestones</h3>
                        <ChevronRight className="w-4 h-4 text-text-secondary" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Award className="w-5 h-5 text-brand" />
                        <div className="flex-1">
                            <p className="text-sm font-bold font-mono text-text-primary">100 Trades</p>
                            <div className="h-1 bg-border rounded-full mt-1">
                                <div className="h-full w-[85%] bg-brand rounded-full" />
                            </div>
                        </div>
                        <span className="text-xs font-mono text-text-secondary">85%</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
