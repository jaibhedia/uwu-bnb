"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { QrCode, Wallet, ArrowDownToLine, ArrowUpFromLine, Eye, Zap, Users } from "lucide-react"

const FEATURES = [
    {
        icon: ArrowDownToLine,
        title: "Deposit USDC",
        description: "Transfer USDC from your external wallet to your uWu wallet on BNB",
        href: "/onboarding"
    },
    {
        icon: ArrowUpFromLine,
        title: "Withdraw USDC",
        description: "Send USDC from your uWu wallet to any external wallet address",
        href: "/onboarding"
    },
    {
        icon: Eye,
        title: "Wallet View",
        description: "View your balance, transaction history, and wallet details on BNB",
        href: "/onboarding"
    },
    {
        icon: QrCode,
        title: "Scan & Pay",
        description: "Scan any UPI QR code, place an order, and get matched to an LP instantly",
        href: "/onboarding"
    }
]

const cardVariant = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
    }),
}

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
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-20 max-w-2xl"
                >
                    <h2 className="text-4xl md:text-5xl font-medium mb-6 tracking-tight text-white">
                        Your Wallet. <br />
                        <span className="text-gray-500">Universal Access.</span>
                    </h2>

                    <p className="text-gray-400 text-lg leading-relaxed">
                        Deposit USDC to your BNB wallet, scan any UPI QR code, and our LPs handle the fiat payment.
                        Simple, secure, non-custodial.
                    </p>
                </motion.div>

                {/* Feature Cards with staggered reveal + hover effects */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/10">
                    {FEATURES.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            custom={index}
                            variants={cardVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            className="border-r border-b border-white/10"
                        >
                            <Link href={feature.href} className="block group h-full">
                                <motion.div
                                    whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                                    className="p-8 h-full flex flex-col items-start bg-transparent relative overflow-hidden"
                                >
                                    {/* Hover glow */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-[#F0B90B]/5 to-transparent pointer-events-none" />

                                    {/* Icon with spring hover */}
                                    <motion.div whileHover={{ scale: 1.2, rotate: -10 }} transition={{ type: "spring", stiffness: 300 }}>
                                        <feature.icon className="w-6 h-6 text-gray-400 mb-8 group-hover:text-[#F0B90B] transition-colors duration-300" strokeWidth={1.5} />
                                    </motion.div>

                                    <h3 className="text-lg font-medium text-white mb-3">{feature.title}</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed mb-8">
                                        {feature.description}
                                    </p>

                                    {/* Slide-in arrow */}
                                    <div className="mt-auto text-sm font-medium text-[#F0B90B] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 flex items-center gap-2">
                                        Open <span className="text-lg leading-none">→</span>
                                    </div>
                                </motion.div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* How it works steps with animated top border */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    className="mt-32"
                >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {[
                            { step: "01", title: "Load Wallet", desc: "Deposit USDC to your BNB wallet" },
                            { step: "02", title: "Scan QR", desc: "Scan any UPI/merchant QR code" },
                            { step: "03", title: "LP Match", desc: "Get matched with a liquidity provider" },
                            { step: "04", title: "Instant Pay", desc: "LP pays the QR, you pay USDC" }
                        ].map((item, index) => (
                            <motion.div
                                key={item.step}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: index * 0.15, duration: 0.5 }}
                                className="relative group"
                            >
                                <motion.div
                                    initial={{ scaleX: 0 }}
                                    whileInView={{ scaleX: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.15 + 0.3, duration: 0.6 }}
                                    className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-white/20 to-transparent group-hover:from-[#F0B90B] transition-all duration-500 origin-left"
                                />
                                <div className="pt-4">
                                    <div className="text-xs font-mono text-gray-600 mb-4">{item.step}</div>
                                    <h4 className="text-lg font-medium text-white mb-2">{item.title}</h4>
                                    <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            </motion.div>
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
                        href="/onboarding"
                        className="group relative inline-flex items-center gap-3 px-8 py-3 bg-white text-black font-semibold rounded overflow-hidden hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-shadow"
                    >
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-[#F0B90B]/20 to-transparent" />
                        <span className="relative z-10">Scan & Pay</span>
                        <span className="relative z-10 group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
