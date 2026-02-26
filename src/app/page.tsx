"use client"

import { useEffect } from "react"
import { Navbar } from "@/components/landing/navbar"
import { Hero } from "@/components/landing/hero"
import { ScanPaySection } from "@/components/landing/scan-pay-section"
import { LPStakeSection } from "@/components/landing/lp-stake-section"
import { DAOSection } from "@/components/landing/dao-section"
import { FAQ } from "@/components/landing/faq"
import { Footer } from "@/components/landing/footer"
import { motion, useMotionValue, useSpring } from "framer-motion"

export default function LandingPage() {
    const mouseX = useMotionValue(0)
    const mouseY = useMotionValue(0)

    // Smooth spring following for fluid feel
    const springX = useSpring(mouseX, { stiffness: 40, damping: 25 })
    const springY = useSpring(mouseY, { stiffness: 40, damping: 25 })

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX)
            mouseY.set(e.clientY + window.scrollY)
        }
        window.addEventListener("mousemove", handleMouseMove)
        return () => window.removeEventListener("mousemove", handleMouseMove)
    }, [mouseX, mouseY])

    return (
        <div className="min-h-screen bg-[#0B0B0E] text-white font-sans selection:bg-purple-500/30 relative overflow-hidden">
            {/* Mouse-following fluid gradient */}
            <motion.div
                style={{ x: springX, y: springY }}
                className="pointer-events-none fixed top-0 left-0 z-[1] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
            >
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#F0B90B] via-purple-500 to-cyan-400 blur-[120px]" />
            </motion.div>

            {/* Second smaller follower for depth */}
            <motion.div
                style={{ x: springX, y: springY }}
                className="pointer-events-none fixed top-0 left-0 z-[1] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-[0.05]"
            >
                <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-400 via-[#F0B90B] to-purple-500 blur-[80px]" />
            </motion.div>

            <Navbar />

            <main className="relative z-[2]">
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
