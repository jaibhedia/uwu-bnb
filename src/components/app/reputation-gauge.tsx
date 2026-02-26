"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface ReputationGaugeProps {
    score: number
    className?: string
}

export function ReputationGauge({ score, className }: ReputationGaugeProps) {
    const getColor = (score: number) => {
        if (score >= 90) return { stroke: "#4ade80", text: "text-neon-green", label: "Excellent" }
        if (score >= 70) return { stroke: "#22d3ee", text: "text-neon-cyan", label: "Good" }
        if (score >= 50) return { stroke: "#facc15", text: "text-yellow-400", label: "Fair" }
        return { stroke: "#f87171", text: "text-red-400", label: "Needs Work" }
    }

    const { stroke, text, label } = getColor(score)
    const circumference = 2 * Math.PI * 45
    const strokeDashoffset = circumference - (score / 100) * circumference

    return (
        <div className={cn("relative w-32 h-32", className)}>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#27272a"
                    strokeWidth="8"
                />
                {/* Progress circle */}
                <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={stroke}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    style={{
                        filter: `drop-shadow(0 0 6px ${stroke})`,
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-2xl font-bold font-mono", text)}>{score}</span>
                <span className="text-xs text-zinc-400">{label}</span>
            </div>
        </div>
    )
}
