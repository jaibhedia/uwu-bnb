"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, RefreshCw } from "lucide-react"
import { fetchLiveRates } from "@/lib/currency-converter"

interface LiveRatePopupProps {
    isOpen: boolean
    onClose: () => void
}

const SPREAD = 0.005 // 0.5% buy/sell spread

export function LiveRatePopup({ isOpen, onClose }: LiveRatePopupProps) {
    const [rate, setRate] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    const loadRates = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)

        try {
            const rates = await fetchLiveRates()
            setRate(rates.INR)
            setLastUpdated(new Date())
        } catch (err) {
            console.error("Failed to fetch rates:", err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            loadRates()
            const interval = setInterval(() => loadRates(true), 30000)
            return () => clearInterval(interval)
        }
    }, [isOpen, loadRates])

    const buyPrice = rate ? (rate * (1 + SPREAD)).toFixed(2) : "—"
    const sellPrice = rate ? (rate * (1 - SPREAD)).toFixed(2) : "—"

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 30 }}
                        transition={{ type: "spring", damping: 28, stiffness: 350 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto"
                    >
                        <div className="bg-[#0B0B0E] border border-[#1a1a2e] rounded-2xl overflow-hidden shadow-2xl shadow-purple-900/10">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                    <h3 className="text-sm font-semibold text-white tracking-wide">
                                        USDC / INR Rate
                                    </h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 hover:bg-white/5 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Rate Cards */}
                            <div className="px-5 pb-5 space-y-3">
                                {loading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                                        <span className="ml-3 text-sm text-gray-500">
                                            Fetching rates...
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Buy Price Card */}
                                        <div className="flex items-center justify-between px-5 py-4 bg-[#111118] border border-[#1a1a2e] rounded-full">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                                                <span className="text-sm font-medium text-gray-300">Buy Price</span>
                                            </div>
                                            <span className="text-base font-bold text-white tracking-tight">
                                                ₹{buyPrice}
                                            </span>
                                        </div>

                                        {/* Sell Price Card */}
                                        <div className="flex items-center justify-between px-5 py-4 bg-[#111118] border border-[#1a1a2e] rounded-full">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
                                                <span className="text-sm font-medium text-gray-300">Sell Price</span>
                                            </div>
                                            <span className="text-base font-bold text-white tracking-tight">
                                                ₹{sellPrice}
                                            </span>
                                        </div>

                                        {/* Footer */}
                                        <div className="flex items-center justify-between pt-2 px-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-600">
                                                    via CoinGecko
                                                </span>
                                                {lastUpdated && (
                                                    <span className="text-[10px] text-gray-700">
                                                        • {lastUpdated.toLocaleTimeString()}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => loadRates(true)}
                                                disabled={refreshing}
                                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                                            >
                                                <RefreshCw
                                                    className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
                                                />
                                                Refresh
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
