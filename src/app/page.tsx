"use client"

import { Navbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { ScanPaySection } from "@/components/landing/scan-pay-section"
import { LPStakeSection } from "@/components/landing/lp-stake-section"
import { DAOSection } from "@/components/landing/dao-section"
import { FAQ } from "@/components/landing/faq"
import { Footer } from "@/components/landing/footer"
import { motion } from "framer-motion"

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0B0B0E] text-white font-sans selection:bg-purple-500/30">
            <Navbar />

            <main>
                <Hero />

                {/* Scan & Pay Section */}
                <ScanPaySection />



                {/* LP Stake Section */}
                <LPStakeSection />

                {/* DAO Section */}
                <DAOSection />

                <FAQ />
            </main>

            <Footer />
        </div>
    )
}
