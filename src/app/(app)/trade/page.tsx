"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const tokens = [
    { symbol: "USDC", balance: 2500 },
    { symbol: "USDT", balance: 1800 },
    { symbol: "ETH", balance: 1.5 },
]

export default function TradePage() {
    const [orderType, setOrderType] = useState<"buy" | "sell">("buy")
    const [selectedToken, setSelectedToken] = useState("USDC")
    const [amount, setAmount] = useState("")

    return (
        <div className="p-6 max-w-xl">
            <div className="mb-8">
                <h1 className="text-xl font-semibold text-white">Trade</h1>
                <p className="text-sm text-zinc-500">Place orders and get matched with LPs</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                {/* Buy/Sell Toggle */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setOrderType("buy")}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors",
                            orderType === "buy"
                                ? "bg-green-500 text-black"
                                : "bg-zinc-800 text-zinc-400 hover:text-white"
                        )}
                    >
                        Buy
                    </button>
                    <button
                        onClick={() => setOrderType("sell")}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors",
                            orderType === "sell"
                                ? "bg-red-500 text-white"
                                : "bg-zinc-800 text-zinc-400 hover:text-white"
                        )}
                    >
                        Sell
                    </button>
                </div>

                {/* Token Selection */}
                <div className="mb-6">
                    <label className="text-xs text-zinc-500 mb-2 block">Token</label>
                    <div className="flex gap-2">
                        {tokens.map((token) => (
                            <button
                                key={token.symbol}
                                onClick={() => setSelectedToken(token.symbol)}
                                className={cn(
                                    "px-4 py-2 text-sm rounded-lg transition-colors",
                                    selectedToken === token.symbol
                                        ? "bg-zinc-700 text-white"
                                        : "bg-zinc-800 text-zinc-400 hover:text-white"
                                )}
                            >
                                {token.symbol}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Amount Input */}
                <div className="mb-6">
                    <label className="text-xs text-zinc-500 mb-2 block">Amount</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-lg focus:border-green-500 focus:outline-none transition-colors"
                        />
                        <button
                            onClick={() => {
                                const token = tokens.find(t => t.symbol === selectedToken)
                                if (token) setAmount(String(token.balance))
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500 hover:text-green-400"
                        >
                            MAX
                        </button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                        Available: {tokens.find(t => t.symbol === selectedToken)?.balance} {selectedToken}
                    </p>
                </div>

                {/* LP Info */}
                <div className="bg-zinc-800 rounded-lg p-3 mb-6">
                    <p className="text-xs text-zinc-400">
                        <span className="text-green-500">AI Matching:</span> Orders $500+ get premium LP rates
                    </p>
                </div>

                {/* Submit */}
                <button
                    disabled={!amount}
                    className={cn(
                        "w-full py-3 text-sm font-medium rounded-lg transition-colors",
                        orderType === "buy"
                            ? "bg-green-500 text-black hover:bg-green-400 disabled:opacity-50"
                            : "bg-red-500 text-white hover:bg-red-400 disabled:opacity-50"
                    )}
                >
                    {orderType === "buy" ? "Buy" : "Sell"} {selectedToken}
                </button>
            </div>
        </div>
    )
}
