import { NextResponse } from "next/server"
import { createPublicClient, http } from "viem"
import { CONTRACT_ADDRESSES, opbnbTestnet } from "@/lib/web3-config"

const publicClient = createPublicClient({
    chain: opbnbTestnet,
    transport: http(),
})

const ESCROW_ABI = [
    {
        inputs: [],
        name: "owner",
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
    },
] as const

const EXPLORER_URL = "https://opbnb-testnet.bscscan.com"

export async function GET() {
    try {
        const escrowAddress = CONTRACT_ADDRESSES.P2P_ESCROW as `0x${string}`
        if (!escrowAddress || escrowAddress === "0x0000000000000000000000000000000000000000") {
            return NextResponse.json({
                success: false,
                error: "Escrow address not configured",
            }, { status: 500 })
        }

        const feeCollector = await publicClient.readContract({
            address: escrowAddress,
            abi: ESCROW_ABI,
            functionName: "owner",
        })

        return NextResponse.json({
            success: true,
            escrowAddress,
            feeCollector: feeCollector as string,
            explorerUrl: EXPLORER_URL,
            note: "Platform fees (0.5% per trade) are sent to the fee collector on each releaseEscrow.",
        })
    } catch (err) {
        console.error("[Contracts API]", err)
        return NextResponse.json(
            { success: false, error: "Failed to read contract" },
            { status: 500 }
        )
    }
}
