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

export function LPStakeSection() {
    return (
        <section id="lp-stake" className="py-24 relative overflow-hidden bg-[#030304]">
             {/* Minimalist Grid Pattern */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20 max-w-2xl"
                >
                    <h2 className="text-4xl md:text-5xl font-medium mb-6 tracking-tight text-white">
                        Stake USDC. <br/>
                        <span className="text-gray-500">Earn Yield.</span>
                    </h2>
                    
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Become a Liquidity Provider by staking a minimum of 50 USDC. 
                        Your stake determines your maximum order matching value.
                    </p>
                </motion.div>

                {/* Minimalism Table/Grid - Aave Style */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/10">
                    {TIER_INFO.map((tier, index) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="relative group border-r border-b border-white/10 p-8 hover:bg-white/[0.03] transition-all"
                        >
                            {/* Tier Name */}
                            <div className="text-sm font-mono text-gray-500 mb-2 uppercase tracking-wider">
                                {tier.name}
                            </div>
                            
                            {/* Stake Amount */}
                            <div className="mb-6">
                                <div className="text-3xl font-medium text-white mb-1">
                                    ${tier.stake}
                                </div>
                                <div className="text-xs text-gray-500">
                                    USDC Stake
                                </div>
                            </div>
                            
                            {/* Max Order */}
                            <div className="mb-8">
                                <div className="text-sm text-white mb-1">
                                    Max Order: {tier.maxOrder}
                                </div>
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-3">
                                    <div 
                                        className="h-full bg-purple-500/50" 
                                        style={{ width: `${(tier.stake / 2000) * 100}%` }}
                                    />
                                </div>
                            </div>
                            
                            {/* Features */}
                            <ul className="space-y-3">
                                {tier.features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                                        {feature}
                                    </li>
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
                        className="inline-flex items-center gap-3 px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-200 transition-all group"
                    >
                        Start as LP
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
