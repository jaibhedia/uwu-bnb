"use client"

import { useState } from "react"
import { Delete } from "lucide-react"

interface NumpadProps {
    value: string
    onChange: (value: string) => void
    maxLength?: number
}

export function Numpad({ value, onChange, maxLength = 10 }: NumpadProps) {
    const handlePress = (digit: string) => {
        if (digit === "." && value.includes(".")) return
        if (value.length >= maxLength) return
        if (value === "0" && digit !== ".") {
            onChange(digit)
        } else {
            onChange(value + digit)
        }
    }

    const handleDelete = () => {
        onChange(value.slice(0, -1) || "0")
    }

    const handleClear = () => {
        onChange("0")
    }

    const handleMax = () => {
        onChange("150") // Mock max based on limit
    }

    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"]

    return (
        <div className="w-full max-w-xs mx-auto">
            <div className="grid grid-cols-3 gap-3">
                {digits.map((digit) => (
                    <button
                        key={digit}
                        onClick={() => handlePress(digit)}
                        className="h-14 text-2xl font-medium text-white rounded-xl active:bg-[#2a2a32] transition-colors"
                    >
                        {digit}
                    </button>
                ))}
                <button
                    onClick={handleDelete}
                    className="h-14 flex items-center justify-center text-[#8b8b9e] rounded-xl active:bg-[#2a2a32] transition-colors"
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>

            <div className="flex justify-center gap-8 mt-6">
                <button
                    onClick={handleMax}
                    className="text-sm font-medium text-[#3b82f6]"
                >
                    Max
                </button>
                <button
                    onClick={handleClear}
                    className="text-sm font-medium text-[#8b5cf6]"
                >
                    Clear
                </button>
            </div>
        </div>
    )
}
