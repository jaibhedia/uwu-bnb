"use client"

import Link from "next/link"
import { Github, Twitter } from "lucide-react"

export function Footer() {
    return (
        <footer className="relative bg-[#030304] pt-32 pb-12 overflow-hidden border-t border-white/5">
            {/* Minimalist Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0" />

            {/* Watermark */}
            <div className="absolute bottom-0 left-0 w-full flex justify-center select-none pointer-events-none opacity-[0.05] overflow-hidden">
                <h1 className="text-[40vw] font-black leading-none tracking-tighter text-white translate-y-[30%]">
                    uWu
                </h1>
            </div>

            <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
                <div className="lg:col-span-1">
                    <div className="flex items-center gap-2 mb-6">
                        <span className="text-xl font-bold text-white tracking-tighter hover:text-[#F0B90B] transition-colors">uWu</span>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                        The first truly decentralized P2P fiat-to-crypto ramp. Pay any UPI QR with stablecoins.
                    </p>

                    <div className="flex gap-4 mt-8">
                        {[Github, Twitter].map((Icon, i) => (
                            <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 hover:text-white text-gray-400 transition-all">
                                <Icon className="w-5 h-5" />
                            </a>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-6">Resources</h4>
                    <ul className="space-y-4 text-gray-400 text-sm">
                        <li><Link href="#" className="hover:text-white">Blog</Link></li>
                        <li><Link href="#" className="hover:text-white">Brand</Link></li>
                        <li><Link href="#" className="hover:text-white">FAQ</Link></li>
                        <li><Link href="#" className="hover:text-white">Case Studies</Link></li>
                        <li><Link href="#" className="hover:text-white">Help & Support</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-6">Developers</h4>
                    <ul className="space-y-4 text-gray-400 text-sm">
                        <li><Link href="#" className="hover:text-white">Build</Link></li>
                        <li><Link href="#" className="hover:text-white">Documentation</Link></li>
                        <li><Link href="#" className="hover:text-white">Technical Paper</Link></li>
                        <li><Link href="#" className="hover:text-white">Case Security</Link></li>
                        <li><Link href="#" className="hover:text-white">Bug Bounty</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-white mb-6">Company</h4>
                    <ul className="space-y-4 text-gray-400 text-sm">
                        <li><Link href="#" className="hover:text-white">Privacy Policy</Link></li>
                        <li><Link href="#" className="hover:text-white">Terms of Service</Link></li>
                        <li><Link href="#" className="hover:text-white">Contact</Link></li>
                        <li><Link href="/grievance" className="hover:text-white">Grievance & Support</Link></li>
                    </ul>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-xs text-gray-600">
                <p>© 2026 uWu Protocol. All rights reserved.</p>
                <div className="flex gap-6 mt-4 md:mt-0">
                    <a href="#" className="hover:text-gray-400">English</a>
                    <a href="#" className="hover:text-gray-400">Sitemap</a>
                </div>
            </div>
        </footer>
    )
}
