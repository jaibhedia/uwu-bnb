"use client"

import Link from "next/link"
import { ArrowLeft, Mail, MessageSquare, Shield, Clock, AlertTriangle } from "lucide-react"

export default function GrievancePage() {
    return (
        <div className="min-h-screen bg-[#030304] text-white">
            {/* Header */}
            <div className="border-b border-white/5">
                <div className="max-w-2xl mx-auto px-6 py-6 flex items-center gap-4">
                    <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Grievance & Support</h1>
                        <p className="text-xs text-zinc-500 mt-0.5">uWu Protocol — Dispute Resolution & Redressal</p>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
                {/* Contact Card */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-[#F0B90B]" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Contact Us</h2>
                            <p className="text-xs text-zinc-500">For any grievances, disputes, or support</p>
                        </div>
                    </div>

                    <a
                        href="mailto:info@abstractstudio.in"
                        className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-xl hover:border-[#F0B90B]/30 hover:bg-[#F0B90B]/5 transition-all group"
                    >
                        <div>
                            <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Email</p>
                            <p className="text-[#F0B90B] font-mono text-sm mt-0.5">info@abstractstudio.in</p>
                        </div>
                        <Mail className="w-4 h-4 text-zinc-600 group-hover:text-[#F0B90B] transition-colors" />
                    </a>

                    <p className="text-xs text-zinc-600 mt-4 leading-relaxed">
                        We aim to respond to all grievances within 48 hours. Please include your wallet address, order ID (if applicable), and a detailed description of the issue.
                    </p>
                </div>

                {/* How It Works */}
                <div>
                    <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-wider mb-4">How Dispute Resolution Works</h3>
                    <div className="space-y-4">
                        {[
                            {
                                icon: Shield,
                                color: "text-blue-400 bg-blue-400/10",
                                title: "Community Validation",
                                desc: "All payments are verified by staked community validators before USDC is released. This prevents most disputes from occurring."
                            },
                            {
                                icon: AlertTriangle,
                                color: "text-orange-400 bg-orange-400/10",
                                title: "Escalation to Admin",
                                desc: "If validators flag a payment, it escalates to our core team for manual review. Evidence from both parties is examined."
                            },
                            {
                                icon: Clock,
                                color: "text-yellow-400 bg-yellow-400/10",
                                title: "Resolution",
                                desc: "Disputes are resolved within 24–48 hours. If an LP is found at fault, their full stake is slashed and the user is compensated."
                            },
                            {
                                icon: MessageSquare,
                                color: "text-purple-400 bg-purple-400/10",
                                title: "Grievance Redressal",
                                desc: "If you're unsatisfied with the outcome or face any issue outside the normal flow, reach out to us via email for a formal review."
                            },
                        ].map((step, i) => (
                            <div key={i} className="flex items-start gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                <div className={`w-9 h-9 rounded-lg ${step.color} flex items-center justify-center shrink-0 mt-0.5`}>
                                    <step.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-sm text-white">{step.title}</h4>
                                    <p className="text-xs text-zinc-500 leading-relaxed mt-1">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* What to Include */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <h3 className="font-bold text-sm mb-4">When Emailing, Please Include:</h3>
                    <ul className="space-y-2 text-sm text-zinc-400">
                        <li className="flex items-start gap-2">
                            <span className="text-[#F0B90B] mt-0.5">•</span>
                            Your wallet address
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#F0B90B] mt-0.5">•</span>
                            Order ID or transaction hash (if applicable)
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#F0B90B] mt-0.5">•</span>
                            Screenshots or proof of the issue
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#F0B90B] mt-0.5">•</span>
                            A clear description of what went wrong
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-[#F0B90B] mt-0.5">•</span>
                            Date and approximate time of the transaction
                        </li>
                    </ul>
                </div>

                {/* Back link */}
                <div className="text-center pt-4 pb-8">
                    <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                        ← Back to uWu
                    </Link>
                </div>
            </div>
        </div>
    )
}
