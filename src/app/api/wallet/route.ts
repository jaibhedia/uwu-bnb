import { NextResponse } from "next/server"

// Mock wallet data
const mockWallet = {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    balance: {
        USDC: 2500,
        USDT: 1800,
        ETH: 1.5,
        BTC: 0.05,
    },
    reputationScore: 85,
    tradingCap: 10000,
}

export async function POST() {
    // Simulate wallet connection
    await new Promise((resolve) => setTimeout(resolve, 500))

    return NextResponse.json({
        success: true,
        wallet: mockWallet,
    })
}

export async function GET() {
    return NextResponse.json({
        connected: true,
        wallet: mockWallet,
    })
}
