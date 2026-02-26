"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Shield, Coins, TrendingUp, CheckCircle } from "lucide-react"

const TIER_INFO = [
    {
        name: "Bronze",
        stake: 50,
        maxOrder: "$50",
        features: ["Priority matching", "2% rewards"]
    },
    {
        name: "Silver",
        stake: 200,
        maxOrder: "$200",
        features: ["Priority matching", "Lower fees", "2.5% rewards"]
    },
    {
        name: "Gold",
        stake: 500,
        maxOrder: "$500",
        features: ["Priority matching", "Lower fees", "LP access", "3% rewards"]
    },
    {
        name: "Diamond",
        stake: 2000,
        maxOrder: "$2000",
        features: ["All Gold benefits", "API access", "Unlimited orders", "3.5% rewards"]
    }
]

const tierVariant = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
    }),
}

export function LPStakeSection() {
    return (
        <section id="lp-stake" className="py-24 relative overflow-hidden bg-[#030304]">
            {/* Minimalist Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />

            {/* Ambient glow */}
            <motion.div
                animate={{ opacity: [0.05, 0.1, 0.05] }}
                transition={{ duration: 8, repeat: Infinity }}
                className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-purple-500/10 rounded-full blur-[120px] z-0"
            />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-20 max-w-2xl"
                >
                    <h2 className="text-4xl md:text-5xl font-medium mb-6 tracking-tight text-white">
                        Stake USDC. <br />
                        <span className="text-gray-500">Earn Yield.</span>
                    </h2>

                    <p className="text-gray-400 text-lg leading-relaxed">
                        Become a Liquidity Provider by staking a minimum of 50 USDC.
                        Your stake determines your maximum order matching value.
                    </p>
                </motion.div>

                {/* Tier Cards with staggered reveal + hover effects */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/10">
                    {TIER_INFO.map((tier, index) => (
                        <motion.div
                            key={tier.name}
                            custom={index}
                            variants={tierVariant}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                            className="relative group border-r border-b border-white/10 p-8 transition-all"
                        >
                            {/* Hover glow */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />

                            {/* Tier Name */}
                            <div className="text-sm font-mono text-gray-500 mb-2 uppercase tracking-wider relative z-10">
                                {tier.name}
                            </div>

                            {/* Stake Amount */}
                            <div className="mb-6 relative z-10">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: index * 0.1 + 0.3 }}
                                    className="text-3xl font-medium text-white mb-1"
                                >
                                    ${tier.stake}
                                </motion.div>
                                <div className="text-xs text-gray-500">
                                    USDC Stake
                                </div>
                            </div>

                            {/* Max Order */}
                            <div className="mb-8 relative z-10">
                                <div className="text-sm text-white mb-1">
                                    Max Order: {tier.maxOrder}
                                </div>
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-3">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${(tier.stake / 2000) * 100}%` }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 + 0.5, duration: 0.8, ease: "easeOut" }}
                                        className="h-full bg-purple-500/50"
                                    />
                                </div>
                            </div>

                            {/* Features with staggered dots */}
                            <ul className="space-y-3 relative z-10">
                                {tier.features.map((feature, i) => (
                                    <motion.li
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 + i * 0.08 + 0.6 }}
                                        className="flex items-start gap-3 text-sm text-gray-400"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                                        {feature}
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mt-20"
                >
                    <Link
                        href="/lp/register"
                        className="group relative inline-flex items-center gap-3 px-8 py-3 bg-white text-black font-semibold rounded overflow-hidden hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-shadow"
                    >
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
                        <span className="relative z-10">Start as LP</span>
                        <span className="relative z-10 group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
