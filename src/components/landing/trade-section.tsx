"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, QrCode, Shield } from "lucide-react"

export function TradeSection() {
    return (
        <section id="trade" className="py-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_#0a192f_0%,_transparent_70%)] opacity-40 z-0" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                        Buy or Sell <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">USDC</span>
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Convert between INR and USDC instantly with our peer-to-peer network.
                        Non-custodial, secure, and with the best rates.
                    </p>
                </motion.div>

                {/* Trade Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Buy Card */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <Link href="/onboarding" className="block group">
                            <div className="relative bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-8 hover:border-green-500/40 transition-all">
                                {/* Icon */}
                                <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <ArrowDownLeft className="w-8 h-8 text-green-400" />
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-3">Buy USDC</h3>
                                <p className="text-gray-400 mb-6">
                                    Convert INR to USDC instantly. Pay via UPI or bank transfer,
                                    receive USDC directly in your wallet.
                                </p>

                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Shield className="w-4 h-4" />
                                        <span>Escrow Protected</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <QrCode className="w-4 h-4" />
                                        <span>UPI Supported</span>
                                    </div>
                                </div>

                                <div className="mt-6 inline-flex items-center gap-2 text-green-400 font-medium group-hover:gap-3 transition-all">
                                    Start Buying
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                        </Link>
                    </motion.div>

                    {/* Sell Card */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <Link href="/onboarding" className="block group">
                            <div className="relative bg-gradient-to-br from-blue-500/10 to-purple-500/5 border border-blue-500/20 rounded-2xl p-8 hover:border-blue-500/40 transition-all">
                                {/* Icon */}
                                <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <ArrowUpRight className="w-8 h-8 text-blue-400" />
                                </div>

                                <h3 className="text-2xl font-bold text-white mb-3">Sell USDC</h3>
                                <p className="text-gray-400 mb-6">
                                    Convert USDC to INR. Provide your UPI QR, get paid by LPs,
                                    and your USDC is settled automatically.
                                </p>

                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Shield className="w-4 h-4" />
                                        <span>Escrow Protected</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <QrCode className="w-4 h-4" />
                                        <span>Instant Matching</span>
                                    </div>
                                </div>

                                <div className="mt-6 inline-flex items-center gap-2 text-blue-400 font-medium group-hover:gap-3 transition-all">
                                    Start Selling
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}
