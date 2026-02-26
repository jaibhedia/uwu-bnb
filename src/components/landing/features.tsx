"use client"

import { motion } from "framer-motion"
import { Shield, Zap, Users, Gift } from "lucide-react"

export function Features() {
    const features = [
        {
            icon: Shield,
            title: "Non-Custodial",
            description: "Your keys, your crypto. We never hold your funds.",
        },
        {
            icon: Zap,
            title: "Instant Settlement",
            description: "Transactions settle in under 90 seconds.",
        },
        {
            icon: Users,
            title: "AI Matching",
            description: "Smart LP matching for optimal rates.",
        },
        {
            icon: Gift,
            title: "Earn Rewards",
            description: "Build reputation, unlock higher limits.",
        },
    ]

    return (
        <section id="features" className="py-24 bg-gray-50">
            <div className="max-w-6xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Why choose uWu?
                    </h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Built for simplicity, security, and speed.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, i) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-colors"
                        >
                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                                <feature.icon className="w-5 h-5 text-gray-700" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export function HowItWorks() {
    const steps = [
        { step: "01", title: "Connect Wallet", desc: "Link your existing wallet or create new" },
        { step: "02", title: "Deposit", desc: "Add USDC, USDT or other crypto" },
        { step: "03", title: "Place Order", desc: "Set amount and get matched" },
        { step: "04", title: "Scan & Pay", desc: "Complete via QR payment" },
    ]

    return (
        <section id="how-it-works" className="py-24 bg-white">
            <div className="max-w-6xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        How it works
                    </h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                        From wallet to payment in four simple steps.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-4 gap-8">
                    {steps.map((item, i) => (
                        <motion.div
                            key={item.step}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="text-center"
                        >
                            <div className="text-5xl font-bold text-gray-200 mb-4">{item.step}</div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                            <p className="text-gray-500 text-sm">{item.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
