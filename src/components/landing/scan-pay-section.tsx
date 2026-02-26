"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { QrCode, Wallet, ArrowDownToLine, ArrowUpFromLine, Eye, Zap, Users } from "lucide-react"

const FEATURES = [
    {
        icon: ArrowDownToLine,
        title: "Deposit USDC",
        description: "Transfer USDC from your external wallet to your uWu wallet on BNB",
        href: "/wallet?action=deposit"
    },
    {
        icon: ArrowUpFromLine,
        title: "Withdraw USDC",
        description: "Send USDC from your uWu wallet to any external wallet address",
        href: "/wallet?action=withdraw"
    },
    {
        icon: Eye,
        title: "Wallet View",
        description: "View your balance, transaction history, and wallet details on BNB",
        href: "/wallet"
    },
    {
        icon: QrCode,
        title: "Scan & Pay",
        description: "Scan any UPI QR code, place an order, and get matched to an LP instantly",
        href: "/scan"
    }
]

export function ScanPaySection() {
    return (
        <section id="scan-pay" className="py-24 relative overflow-hidden bg-[#030304]">
            {/* Minimalist Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />
            
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20 max-w-2xl"
                >
                    <h2 className="text-4xl md:text-5xl font-medium mb-6 tracking-tight text-white">
                        Your Wallet. <br/>
                        <span className="text-gray-500">Universal Access.</span>
                    </h2>
                    
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Deposit USDC to your BNB wallet, scan any UPI QR code, and our LPs handle the fiat payment. 
                        Simple, secure, non-custodial.
                    </p>
                </motion.div>

                {/* Feature Cards - Aave Minimalist Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/10">
                    {FEATURES.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="border-r border-b border-white/10"
                        >
                            <Link href={feature.href} className="block group h-full">
                                <div className="p-8 hover:bg-white/[0.03] transition-colors h-full flex flex-col items-start bg-transparent">
                                    {/* Icon - Minimalist */}
                                    <feature.icon className="w-6 h-6 text-gray-400 mb-8 group-hover:text-[#F0B90B] transition-colors" strokeWidth={1.5} />
                                    
                                    <h3 className="text-lg font-medium text-white mb-3">{feature.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                                        {feature.description}
                                    </p>
                                    
                                    {/* Hover indicator - Arrow animation */}
                                    <div className="mt-auto text-sm font-medium text-[#F0B90B] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all flex items-center gap-2">
                                        Open <span className="text-lg leading-none">→</span>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* How it works - Minimalist Steps */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mt-32"
                >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {[
                            { step: "01", title: "Load Wallet", desc: "Deposit USDC to your BNB wallet" },
                            { step: "02", title: "Scan QR", desc: "Scan any UPI/merchant QR code" },
                            { step: "03", title: "LP Match", desc: "Get matched with a liquidity provider" },
                            { step: "04", title: "Instant Pay", desc: "LP pays the QR, you pay USDC" }
                        ].map((item, index) => (
                            <div key={item.step} className="relative group">
                                <div className="text-xs font-mono text-gray-600 mb-4">{item.step}</div>
                                <h4 className="text-lg font-medium text-white mb-2">{item.title}</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-white/20 to-transparent group-hover:from-[#F0B90B] transition-all duration-500" />
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mt-20"
                >
                    <Link
                        href="/scan"
                        className="inline-flex items-center gap-3 px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-200 transition-all group"
                    >
                        Scan & Pay
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
