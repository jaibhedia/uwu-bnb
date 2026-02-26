"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Scale, Users, Vote, Shield, ArrowUpRight } from "lucide-react"

const featureVariant = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
        opacity: 1,
        x: 0,
        transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" as const },
    }),
}

const statVariant = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: (i: number) => ({
        opacity: 1,
        scale: 1,
        transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
    }),
}

export function DAOSection() {
    return (
        <section id="dao" className="py-24 relative overflow-hidden bg-[#030304]">
            {/* Minimalist Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />

            {/* Ambient glow */}
            <motion.div
                animate={{ opacity: [0.05, 0.12, 0.05] }}
                transition={{ duration: 6, repeat: Infinity }}
                className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-[#F0B90B]/10 rounded-full blur-[120px] -translate-y-1/2 z-0"
            />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <h2 className="text-4xl md:text-5xl font-medium mb-6 tracking-tight text-white">
                            Community <br />
                            <span className="text-gray-500">Governance.</span>
                        </h2>

                        <p className="text-gray-400 text-lg mb-12 leading-relaxed">
                            Our community-driven dispute resolution ensures fair outcomes for every trade.
                            Qualified arbitrators vote on disputes, with transparent on-chain governance.
                        </p>

                        {/* Features with staggered slide-in + animated borders */}
                        <div className="space-y-8 mb-12">
                            {[
                                { title: "Stake-Based Sybil Resistance", desc: "$100 USDC stake to become a validator — no KYC" },
                                { title: "Majority Voting", desc: "Majority of validators must agree to approve or flag" },
                                { title: "Full Slash on Wrong Vote", desc: "100% stake slashed instantly for voting against consensus" }
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    custom={i}
                                    variants={featureVariant}
                                    initial="hidden"
                                    whileInView="visible"
                                    viewport={{ once: true }}
                                    className="group cursor-default"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-medium text-white group-hover:text-[#F0B90B] transition-colors duration-300">{feature.title}</h3>
                                        <motion.span
                                            initial={{ opacity: 0, x: -5 }}
                                            whileHover={{ opacity: 1, x: 0 }}
                                            className="text-[#F0B90B] text-xl"
                                        >→</motion.span>
                                    </div>
                                    <p className="text-gray-500 text-sm border-b border-white/5 pb-6 group-hover:border-[#F0B90B]/30 transition-colors duration-300">
                                        {feature.desc}
                                    </p>
                                </motion.div>
                            ))}
                        </div>

                    </motion.div>

                    {/* Stats Grid with pop-in animation */}
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: "Disputes Reviewed", value: "48", icon: Scale },
                            { label: "Avg. Resolution", value: "~2h", icon: Users },
                            { label: "Active Validators", value: "12", icon: Vote },
                            { label: "Accuracy Rate", value: "97%", icon: Shield }
                        ].map((stat, i) => (
                            <motion.div
                                key={i}
                                custom={i}
                                variants={statVariant}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                whileHover={{ scale: 1.03, borderColor: "rgba(240,185,11,0.2)" }}
                                transition={{ type: "spring", stiffness: 300 }}
                                className="bg-white/[0.02] border border-white/10 p-6 flex flex-col justify-between h-40 group transition-colors"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
                                    <stat.icon className="w-5 h-5 text-gray-600 group-hover:text-[#F0B90B] transition-colors duration-300" />
                                </div>
                                <div className="text-3xl font-medium text-white">
                                    {stat.value}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mt-20"
                >
                    <Link
                        href="/dao"
                        className="group relative inline-flex items-center gap-3 px-8 py-3 bg-white text-black font-semibold rounded overflow-hidden hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-shadow"
                    >
                        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-[#F0B90B]/20 to-transparent" />
                        <span className="relative z-10">Enter DAO</span>
                        <span className="relative z-10 group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
