"use client"

import { useState, useEffect } from "react"
import { QrCode, ArrowRight, ShieldCheck, Wallet, X, ChevronLeft, ChevronRight } from "lucide-react"

interface TutorialOverlayProps {
    address: string | undefined
    onClose: () => void
}

const SLIDES = [
    {
        icon: QrCode,
        iconColor: "text-[#F0B90B]",
        iconBg: "bg-[#F0B90B]/10",
        title: "Scan & Pay",
        description: "Scan any UPI QR code, enter the INR amount you want to pay. We'll find the best LP to handle your payment.",
        detail: "Works with any UPI merchant — chai stall to Amazon.",
    },
    {
        icon: Wallet,
        iconColor: "text-emerald-400",
        iconBg: "bg-emerald-400/10",
        title: "LP Pays for You",
        description: "A matched Liquidity Provider sends INR to the merchant via UPI. They upload payment proof for verification.",
        detail: "LP's USDC is locked in escrow until confirmed.",
    },
    {
        icon: ArrowRight,
        iconColor: "text-blue-400",
        iconBg: "bg-blue-400/10",
        title: "USDC Released",
        description: "DAO validators verify the payment proof. Once approved, your USDC is released from escrow to the LP.",
        detail: "Settlement in under 10 minutes.",
    },
    {
        icon: ShieldCheck,
        iconColor: "text-purple-400",
        iconBg: "bg-purple-400/10",
        title: "Protected by DAO",
        description: "Any dispute? Evidence is stored on IPFS. Community validators vote. Admin mediates if needed.",
        detail: "Stake-backed trust — no KYC required.",
    },
]

export function TutorialOverlay({ address, onClose }: TutorialOverlayProps) {
    const [current, setCurrent] = useState(0)
    const [visible, setVisible] = useState(false)

    const storageKey = address ? `uwu_tutorial_seen_${address.toLowerCase()}` : null

    useEffect(() => {
        if (!storageKey) return
        const seen = localStorage.getItem(storageKey)
        if (!seen) {
            setVisible(true)
        }
    }, [storageKey])

    const handleDismiss = () => {
        if (storageKey) {
            localStorage.setItem(storageKey, "true")
        }
        setVisible(false)
        onClose()
    }

    const handleNext = () => {
        if (current < SLIDES.length - 1) {
            setCurrent(current + 1)
        } else {
            handleDismiss()
        }
    }

    const handlePrev = () => {
        if (current > 0) setCurrent(current - 1)
    }

    if (!visible) return null

    const slide = SLIDES[current]
    const isLast = current === SLIDES.length - 1
    const Icon = slide.icon

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                {/* Skip button */}
                <div className="flex justify-end p-3 pb-0">
                    <button
                        onClick={handleDismiss}
                        className="text-zinc-500 hover:text-white transition-colors p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Slide content */}
                <div className="px-8 pb-2 pt-2 text-center">
                    {/* Icon */}
                    <div className={`w-16 h-16 rounded-2xl ${slide.iconBg} flex items-center justify-center mx-auto mb-5`}>
                        <Icon className={`w-8 h-8 ${slide.iconColor}`} />
                    </div>

                    {/* Step indicator */}
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mb-2">
                        Step {current + 1} of {SLIDES.length}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-white mb-3">{slide.title}</h2>

                    {/* Description */}
                    <p className="text-sm text-zinc-400 leading-relaxed mb-2">
                        {slide.description}
                    </p>

                    {/* Detail */}
                    <p className="text-xs text-zinc-600 italic">
                        {slide.detail}
                    </p>
                </div>

                {/* Dots */}
                <div className="flex justify-center gap-2 py-4">
                    {SLIDES.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            className={`w-2 h-2 rounded-full transition-all ${i === current
                                    ? "bg-[#F0B90B] w-6"
                                    : "bg-zinc-700 hover:bg-zinc-500"
                                }`}
                        />
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex gap-3 px-6 pb-6">
                    {current > 0 ? (
                        <button
                            onClick={handlePrev}
                            className="flex-none w-12 h-12 border border-white/10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleDismiss}
                            className="flex-none px-4 h-12 border border-white/10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/20 transition-colors text-sm"
                        >
                            Skip
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        className={`flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isLast
                                ? "bg-[#F0B90B] text-black hover:bg-[#F0B90B]/90"
                                : "bg-white/10 text-white hover:bg-white/15"
                            }`}
                    >
                        {isLast ? (
                            <>Let&apos;s Go!</>
                        ) : (
                            <>
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
