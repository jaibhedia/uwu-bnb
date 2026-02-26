"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Wallet, FileCode, Loader2, ArrowLeft } from "lucide-react"

const EXPLORER = "https://opbnb-testnet.bscscan.com"

export default function ContractsPage() {
    const [data, setData] = useState<{
        escrowAddress: string
        feeCollector: string
        note: string
    } | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetch("/api/contracts")
            .then((res) => res.json())
            .then((json) => {
                if (json.success) {
                    setData({
                        escrowAddress: json.escrowAddress,
                        feeCollector: json.feeCollector,
                        note: json.note || "",
                    })
                } else {
                    setError(json.error || "Failed to load")
                }
            })
            .catch(() => setError("Failed to load"))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="min-h-screen bg-background text-text-primary font-mono">
            <div className="max-w-lg mx-auto px-4 py-12">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-text-secondary hover:text-brand text-sm mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to home
                </Link>

                <h1 className="text-2xl font-bold text-white mb-2">Contracts & Fee Collector</h1>
                <p className="text-text-secondary text-sm mb-8">
                    Where protocol fees go and how to check them on-chain.
                </p>

                {loading && (
                    <div className="flex items-center gap-2 text-text-secondary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading...
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
                        {error}
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-6">
                        <div className="p-4 rounded-lg bg-surface border border-border">
                            <div className="flex items-center gap-2 text-brand mb-2">
                                <Wallet className="w-5 h-5" />
                                <span className="font-bold uppercase text-sm">Fee collector</span>
                            </div>
                            <p className="text-text-secondary text-xs mb-2">
                                All platform fees (0.5% per trade) are sent to this wallet when an order is released.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-sm text-white break-all">
                                    {data.feeCollector}
                                </code>
                                <a
                                    href={`${EXPLORER}/address/${data.feeCollector}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-brand hover:underline text-sm"
                                >
                                    View on Explorer <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg bg-surface border border-border">
                            <div className="flex items-center gap-2 text-brand mb-2">
                                <FileCode className="w-5 h-5" />
                                <span className="font-bold uppercase text-sm">Escrow contract</span>
                            </div>
                            <p className="text-text-secondary text-xs mb-2">
                                P2P Escrow (V5). User funds and fees are handled here; owner() receives fees on release.
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-sm text-white break-all">
                                    {data.escrowAddress}
                                </code>
                                <a
                                    href={`${EXPLORER}/address/${data.escrowAddress}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-brand hover:underline text-sm"
                                >
                                    View on Explorer <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>

                        {data.note && (
                            <p className="text-text-secondary text-xs">
                                {data.note}
                            </p>
                        )}

                        <p className="text-text-secondary text-xs pt-4 border-t border-border">
                            Core team: use <Link href="/admin" className="text-brand hover:underline">/admin</Link> → Revenue tab for fee stats and revenue breakdown (wallet must be in core team list).
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
