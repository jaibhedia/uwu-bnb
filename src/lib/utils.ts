import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

export function formatCrypto(amount: number, symbol: string): string {
  return `${amount.toLocaleString()} ${symbol}`
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function getReputationColor(score: number): string {
  if (score >= 90) return "text-neon-green"
  if (score >= 70) return "text-neon-cyan"
  if (score >= 50) return "text-yellow-400"
  return "text-red-400"
}
