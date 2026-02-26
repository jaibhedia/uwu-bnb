"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Minus } from "lucide-react"

export function FAQ() {
    const faqs = [
        {
            question: "How does UWU protect you from account freeze fraud?",
            answer: "uWu uses a decentralized reputation system and non-custodial smart contracts. Funds are only released when both parties confirm, and disputes are handled via an on-chain arbitration protocol."
        },
        {
            question: "Do I need KYC to use UWU?",
            answer: "No. uWu is a purely non-custodial protocol. You connect your wallet and transact directly. We do not store personal data."
        },
        {
            question: "What is UWU?",
            answer: "uWu is a decentralized liquidity protocol for the next generation of on-chain finance, enabling seamless crypto-to-fiat settlements via P2P networks."
        }
    ]

    return (
        <section className="py-24 relative z-10 bg-[#030304] overflow-hidden">
             {/* Minimalist Grid Pattern */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />

            <div className="max-w-4xl mx-auto px-6 relative z-10">
                <h2 className="text-4xl md:text-5xl font-medium text-white mb-20 tracking-tight">
                    Frequently Asked <br /> Questions
                </h2>

                <div className="space-y-8">
                    {faqs.map((faq, i) => (
                        <FAQItem key={i} question={faq.question} answer={faq.answer} />
                    ))}
                </div>
            </div>
        </section>
    )
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="border-t border-gray-800 py-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-left group"
            >
                <span className="text-xl md:text-2xl font-medium text-white group-hover:text-blue-500 transition-colors">
                    {question}
                </span>
                <div className="p-2 rounded-full border border-gray-700 bg-white/5 group-hover:bg-white/10 transition-colors">
                    {isOpen ? <Minus className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <p className="pt-6 text-gray-400 text-lg leading-relaxed max-w-2xl">
                            {answer}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
