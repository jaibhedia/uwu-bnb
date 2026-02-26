"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Check, QrCode, Activity } from "lucide-react"

export function Hero() {
    return (
        <div className="relative pt-32 pb-20 min-h-screen flex items-center overflow-hidden bg-[#030304]">
            {/* Background Gradient - Minimalist */}
            <div className="absolute top-0 left-0 right-0 h-[500px] bg-[radial-gradient(circle_at_top,_#1e1b4b_0%,_transparent_50%)] opacity-40 z-0 pointer-events-none" />

            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />

            <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-[#F0B90B] animate-pulse" />
                        <span className="text-gray-300 text-sm font-medium">Live on opBNB Testnet</span>
                    </div>

                    <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight mb-8 leading-tight">
                        Payments <br />
                        <span className="text-gray-500">Reimagined.</span>
                    </h1>

                    <p className="text-lg text-gray-400 max-w-md mb-10 leading-relaxed">
                        The first truly decentralized P2P fiat-to-crypto ramp.
                        Pay any UPI QR code instantly using your stablecoins.
                    </p>

                    <div className="space-y-4 mb-10">
                        {[
                            "Zero custody, fully on-chain settlement",
                            "Trustless P2P using zk-verify logic",
                            "Earn 3.5% yield as a Liquidity Provider"
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                    <Check className="w-3 h-3 text-green-400" />
                                </div>
                                <span className="text-gray-300 font-medium">{item}</span>
                            </div>
                        ))}
                    </div>

                    <Link
                        href="/onboarding"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-all shadow-lg shadow-white/5 group"
                    >
                        <QrCode className="w-5 h-5" />
                        Start Scanning
                    </Link>
                </motion.div>

                {/* Phone Visual */}
                <motion.div
                    initial={{ opacity: 0, x: 50, rotate: 10 }}
                    animate={{ opacity: 1, x: 0, rotate: 12 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="relative"
                >
                    {/* Phone Frame */}
                    <div className="relative w-[300px] h-[600px] border-[14px] border-[#202020] rounded-[3rem] bg-black shadow-2xl mx-auto overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-7 bg-[#202020] rounded-b-xl z-20" />

                        {/* Screen Content */}
                        <div className="w-full h-full bg-[#0a0a0a] pt-14 px-6 flex flex-col items-center">
                            <h3 className="text-white font-bold text-xl mb-8">Scan & Pay</h3>

                            <div className="w-48 h-48 bg-white/10 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center mb-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 animate-pulse" />
                                <div className="w-32 h-32 bg-white p-2 rounded-lg">
                                    {/* Mock QR */}
                                    <div className="w-full h-full bg-black pattern-grid-lg opacity-80" />
                                </div>
                                {/* Scanning Line */}
                                <motion.div
                                    animate={{ top: ["0%", "100%", "0%"] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-0.5 bg-[#F0B90B] shadow-[0_0_15px_rgba(240,185,11,1)]"
                                />
                            </div>

                            <div className="bg-white/5 rounded-xl p-3 w-full mb-6">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>You Pay</span>
                                    <span>Merchant Receives</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white font-bold">2.2 USDC</span>
                                    <span className="text-gray-600">→</span>
                                    <span className="text-white font-bold">₹ 199.34 INR</span>
                                </div>
                            </div>

                            <Link href="/scan" className="block w-full py-4 bg-gradient-to-r from-white to-gray-400 rounded-xl text-black font-bold shadow-lg shadow-white/20 transition-colors text-center">
                                Pay
                            </Link>
                        </div>
                    </div>

                    {/* Glow Effect behind phone */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[600px] bg-green-600/20 blur-[100px] -z-10 rounded-full pointer-events-none" />
                </motion.div>

            </div>
        </div>
    )
}
