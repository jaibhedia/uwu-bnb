"use client"

import CountUp from "react-countup"
import { motion, useScroll, useTransform } from "framer-motion"
import { Activity, Zap } from "lucide-react"

export function Stats() {
    const { scrollY } = useScroll()
    const y1 = useTransform(scrollY, [0, 500], [0, 100])
    const y2 = useTransform(scrollY, [0, 500], [0, -100])

    return (
        <div className="relative hidden lg:block h-full min-h-[400px] w-full max-w-[500px]">
            <motion.div
                style={{ y: y1 }}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="absolute top-10 right-0 w-full"
            >
                <div className="bg-[#121212]/50 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] shadow-2xl skew-y-[-2deg] hover:skew-y-0 transition-all duration-500 group hover:border-[#3b82f6]/30 hover:shadow-[0_0_50px_rgba(59,130,246,0.1)]">
                    <div className="flex items-center justify-between mb-8">
                        <div className="p-3 bg-white/5 rounded-2xl">
                            <Activity className="w-6 h-6 text-[#3b82f6]" />
                        </div>
                        <span className="text-xs font-bold tracking-widest text-[#a3a3a3] uppercase">Market Size</span>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <p className="text-sm text-[#a3a3a3] mb-1">P2P Volume (Testnet)</p>
                            <p className="text-4xl font-black text-white">$<CountUp end={12.5} decimals={1} duration={2} />K</p>
                        </div>

                        <div className="h-px bg-white/10" />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-[#a3a3a3] mb-1">Active LPs</p>
                                <p className="text-xl font-bold text-white"><CountUp end={24} duration={2} /></p>
                            </div>
                            <div>
                                <p className="text-xs text-[#a3a3a3] mb-1">Total Staked</p>
                                <p className="text-xl font-bold text-white">$<CountUp end={8.2} decimals={1} duration={2} />K</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Element 2 */}
                <motion.div
                    style={{ y: y2 }}
                    animate={{ y: [0, -20, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -bottom-20 -left-10 bg-[#1e1e1e] p-4 rounded-2xl border border-white/5 shadow-xl flex items-center gap-3 w-56 backdrop-blur-md"
                >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-400">Avg. Settlement</p>
                        <p className="text-lg font-bold text-white">12 seconds</p>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    )
}
