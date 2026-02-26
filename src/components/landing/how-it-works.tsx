"use client"

import { motion } from "framer-motion"
import { Wallet, ArrowLeftRight, CheckCircle2 } from "lucide-react"

export function HowItWorks() {
    const steps = [
        {
            id: 1,
            title: "Connect Wallet",
            desc: "Link your Web3 wallet (Metamask, Rabby, etc.) to authenticate.",
            icon: Wallet,
            color: "from-blue-500 to-cyan-500"
        },
        {
            id: 2,
            title: "Request Match",
            desc: "Enter the amount of INR you need. Our protocol finds a solver instantly.",
            icon: ArrowLeftRight,
            color: "from-purple-500 to-pink-500"
        },
        {
            id: 3,
            title: "Settle via UPI",
            desc: "Receive INR directly to your UPI ID. Usdc is released trustlessly.",
            icon: CheckCircle2,
            color: "from-green-500 to-emerald-500"
        }
    ]

    return (
        <section className="py-24 relative overflow-hidden">
            <div className="text-center mb-20">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-black mb-4"
                >
                    Direct P2P Settlement
                </motion.h2>
                <p className="text-[#a3a3a3] max-w-2xl mx-auto">
                    No exchanges, no P2P scams. Just protocol-level matchmaking.
                </p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-6">
                {/* Connecting Line */}
                <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-green-500/20" />

                {steps.map((step, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.2 }}
                        viewport={{ once: true }}
                        className="relative z-10 flex flex-col items-center text-center"
                    >
                        <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${step.color} p-0.5 mb-8 shadow-2xl`}>
                            <div className="w-full h-full bg-[#0a0a0a] rounded-[22px] flex items-center justify-center relative overflow-hidden group">
                                <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                                <step.icon className="w-10 h-10 text-white" />
                            </div>
                        </div>

                        <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-[#a3a3a3] mb-4">
                            Step 0{step.id}
                        </div>

                        <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                        <p className="text-[#a3a3a3] text-sm leading-relaxed max-w-xs">
                            {step.desc}
                        </p>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}
