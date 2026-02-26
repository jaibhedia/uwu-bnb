"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Scale, Users, Vote, Shield, ArrowUpRight } from "lucide-react"

export function DAOSection() {
    return (
        <section id="dao" className="py-24 relative overflow-hidden bg-[#030304]">
             {/* Minimalist Grid Pattern */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />
            
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-4xl md:text-5xl font-medium mb-6 tracking-tight text-white">
                            Community <br/>
                            <span className="text-gray-500">Governance.</span>
                        </h2>
                        
                        <p className="text-gray-400 text-lg mb-12 leading-relaxed">
                            Our community-driven dispute resolution ensures fair outcomes for every trade. 
                            Qualified arbitrators vote on disputes, with transparent on-chain governance.
                        </p>
                        
                        {/* Features - Aave Minimalist List */}
                        <div className="space-y-8 mb-12">
                            {[
                                { title: "Community Arbitrators", desc: "Qualified stakers can become arbitrators" },
                                { title: "Democratic Voting", desc: "Multi-sig voting ensures fair decisions" },
                                { title: "Stake Protection", desc: "Losers are slashed, winners are protected" }
                            ].map((feature, i) => (
                                <div key={i} className="group cursor-default">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-medium text-white group-hover:text-[#F0B90B] transition-colors">{feature.title}</h3>
                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#F0B90B] text-xl">→</span>
                                    </div>
                                    <p className="text-gray-500 text-sm border-b border-white/5 pb-6 group-hover:border-[#F0B90B]/30 transition-colors">
                                        {feature.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                        
                    </motion.div>

                    {/* Stats - Redone Minimalist Grid */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="grid grid-cols-2 gap-4"
                    >
                        {[
                            { label: "Total Disputes", value: "1,248", icon: Scale },
                            { label: "Resolution Time", value: "~12h", icon: Users },
                            { label: "Active Arbitrators", value: "400+", icon: Vote },
                            { label: "Accuracy Rate", value: "99.8%", icon: Shield }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/10 p-6 flex flex-col justify-between h-40 group hover:border-white/20 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
                                    <stat.icon className="w-5 h-5 text-gray-600 group-hover:text-[#F0B90B] transition-colors" />
                                </div>
                                <div className="text-3xl font-medium text-white">
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </motion.div>
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
                        className="inline-flex items-center gap-3 px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-200 transition-all group"
                    >
                        Enter DAO
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                </motion.div>
            </div>
        </section>
    )
}
