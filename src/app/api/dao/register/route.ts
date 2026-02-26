import { NextRequest, NextResponse } from "next/server"
import {
    getValidatorProfile,
    setValidatorProfile,
    getAllValidatorProfiles,
    type ValidatorProfile,
} from "@/lib/validation-store"

/**
 * DAO Validator Registration API
 * 
 * POST: Register as a DAO validator ($100 USDC minimum stake)
 * GET:  Check validator status / get all validators
 * 
 * Sybil resistance: stake-only. $100 per identity = $300 to control majority.
 * Slashing: 100% slash on ONE wrong vote (against consensus).
 */

const MIN_DAO_STAKE = 100 // $100 USDC minimum

// ─── GET /api/dao/register ──────────────────────────────
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (address) {
        // Get single validator profile
        const profile = await getValidatorProfile(address)
        if (!profile) {
            return NextResponse.json({
                success: true,
                registered: false,
                minStake: MIN_DAO_STAKE,
            })
        }

        // Release expired locks
        const now = Date.now()
        const activeLocks = profile.lockedOrders?.filter(l => l.lockedUntil > now) || []
        const releasedAmount = (profile.lockedOrders?.filter(l => l.lockedUntil <= now) || [])
            .reduce((sum, l) => sum + l.amount, 0)

        if (releasedAmount > 0) {
            profile.lockedOrders = activeLocks
            profile.lockedAmount = activeLocks.reduce((sum, l) => sum + l.amount, 0)
            await setValidatorProfile(profile)
        }

        const availableStake = profile.staked - profile.lockedAmount

        return NextResponse.json({
            success: true,
            registered: true,
            profile: {
                ...profile,
                availableStake,
            },
        })
    }

    // List all active validators
    const all = await getAllValidatorProfiles()
    const active = all.filter(v => v.isActive && !v.isSlashed)

    return NextResponse.json({
        success: true,
        validators: active.map(v => ({
            address: v.address,
            staked: v.staked,
            lockedAmount: v.lockedAmount,
            availableStake: v.staked - v.lockedAmount,
            totalReviews: v.totalReviews,
            accuracy: v.accuracy,
            isSlashed: v.isSlashed,
        })),
        count: active.length,
        minStake: MIN_DAO_STAKE,
    })
}

// ─── POST /api/dao/register ─────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { address, stakeAmount } = body

        if (!address) {
            return NextResponse.json(
                { success: false, error: "Address required" },
                { status: 400 }
            )
        }

        const addr = address.toLowerCase()

        // Check if already registered
        const existing = await getValidatorProfile(addr)
        if (existing && existing.isActive && !existing.isSlashed) {
            return NextResponse.json(
                { success: false, error: "Already registered as validator" },
                { status: 400 }
            )
        }

        // Validate stake amount
        const stake = Number(stakeAmount)
        if (!stake || stake < MIN_DAO_STAKE) {
            return NextResponse.json(
                { success: false, error: `Minimum stake is $${MIN_DAO_STAKE} USDC` },
                { status: 400 }
            )
        }

        // For hackathon: trust the client-declared stake.
        // Production: read from on-chain staking contract.
        const profile: ValidatorProfile = {
            address: addr,
            totalReviews: 0,
            totalEarned: 0,
            approvals: 0,
            flags: 0,
            accuracy: 100,
            staked: stake,
            lockedAmount: 0,
            lockedOrders: [],
            isSlashed: false,
            isActive: true,
            registeredAt: Date.now(),
        }

        await setValidatorProfile(profile)

        console.log(`[DAO] Validator registered: ${addr} with $${stake} stake`)

        return NextResponse.json({
            success: true,
            message: `Registered as DAO validator with $${stake} USDC stake`,
            profile,
        })
    } catch (error) {
        console.error("[DAO] Registration error:", error)
        return NextResponse.json(
            { success: false, error: "Registration failed" },
            { status: 500 }
        )
    }
}
