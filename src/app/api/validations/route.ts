import { NextRequest, NextResponse } from "next/server"
import { getOrder, setOrder } from "@/lib/order-store"
import {
    type ValidationTask,
    type ValidationVote,
    getNextTaskId,
    getValidationTask,
    setValidationTask,
    getAllValidationTasks,
    getValidatorProfile,
    setValidatorProfile,
    getAllValidatorProfiles,
} from "@/lib/validation-store"

/**
 * DAO Validation API (Redis-backed)
 * 
 * Dynamic majority model: threshold = total eligible validators.
 * Majority (ceil(N/2)) approve → LP gets paid. Majority flag → escalated.
 * Validators earn $0.05 USDC per review.
 */

// ─── Config ─────────────────────────────────────────────
const FALLBACK_THRESHOLD = Number(process.env.NEXT_PUBLIC_VALIDATION_THRESHOLD || "3")
const MIN_THRESHOLD = 1
const VALIDATOR_REWARD = Number(process.env.NEXT_PUBLIC_VALIDATOR_REWARD || "0.05")
const VALIDATION_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour auto-approve

/**
 * Create a validation task for an order entering "verifying" status.
 * Called from orders API when LP submits payment proof.
 */
export async function createValidationTask(order: {
    id: string
    qrImage?: string
    userAddress: string
    lpPaymentProof?: string
    solverAddress?: string
    amountUsdc: number
    amountFiat: number
    fiatCurrency: string
    paymentMethod: string
}): Promise<ValidationTask> {
    const taskId = await getNextTaskId()

    // Count eligible validators (all registered, excluding order parties)
    const allValidators = await getAllValidatorProfiles()
    const eligible = allValidators.filter(v => {
        const vAddr = v.address.toLowerCase()
        return vAddr !== order.userAddress.toLowerCase() &&
            vAddr !== (order.solverAddress || '').toLowerCase()
    })

    // Threshold = total eligible validators (min 1, fallback to env config if 0)
    const threshold = eligible.length >= MIN_THRESHOLD
        ? eligible.length
        : FALLBACK_THRESHOLD

    const task: ValidationTask = {
        id: taskId,
        orderId: order.id,
        status: 'pending',
        evidence: {
            userQrImage: order.qrImage,
            userAddress: order.userAddress,
            lpScreenshot: order.lpPaymentProof,
            lpAddress: order.solverAddress || '',
            amountUsdc: order.amountUsdc,
            amountFiat: order.amountFiat,
            fiatCurrency: order.fiatCurrency,
            paymentMethod: order.paymentMethod,
        },
        votes: [],
        threshold,
        createdAt: Date.now(),
        deadline: Date.now() + VALIDATION_TIMEOUT_MS,
    }

    await setValidationTask(task)
    console.log(`[Validation] Created task ${taskId} for order ${order.id} — threshold: ${threshold} validators (${eligible.length} eligible)`)
    return task
}

/**
 * Check and resolve timed-out validations
 */
async function checkTimeouts() {
    const now = Date.now()
    const pendingTasks = await getAllValidationTasks({ status: 'pending', includeResolved: false })

    for (const task of pendingTasks) {
        if (now > task.deadline) {
            task.status = 'auto_approved'
            task.resolvedAt = now
            task.resolvedBy = 'timeout'
            await setValidationTask(task)
            await completeOrder(task.orderId)
            console.log(`[Validation] Auto-approved task ${task.id} (timeout)`)
        }
    }
}

/**
 * Complete order after validation approval
 */
async function completeOrder(orderId: string) {
    const order = await getOrder(orderId)
    if (!order || order.status !== 'verifying') return

    const now = Date.now()
    order.status = 'completed'
    order.completedAt = now
    order.settledAt = now
    order.disputePeriodEndsAt = now + 24 * 60 * 60 * 1000
    order.stakeLockExpiresAt = now + 24 * 60 * 60 * 1000
    await setOrder(order)
    console.log(`[Validation] Order ${orderId} completed after DAO approval`)
}

/**
 * Freeze order after validation flagging (escalate to admin)
 */
async function freezeOrder(orderId: string) {
    const order = await getOrder(orderId)
    if (!order) return

    order.status = 'disputed'
    await setOrder(order)
    console.log(`[Validation] Order ${orderId} frozen — escalated to admin`)
}

/**
 * Credit validator reward (only if registered and active)
 */
async function creditValidator(address: string) {
    const addr = address.toLowerCase()
    const profile = await getValidatorProfile(addr)
    if (!profile) return // unregistered — skipped
    if (profile.isSlashed) return // slashed — no rewards

    profile.totalReviews++
    profile.totalEarned += VALIDATOR_REWARD
    profile.lastReviewAt = Date.now()
    await setValidatorProfile(profile)
}

/**
 * Update validator accuracy + FULL SLASH on wrong vote.
 * One wrong vote = 100% stake slashed, validator banned.
 */
async function updateAccuracy(task: ValidationTask) {
    const isApproved = task.status === 'approved' || task.status === 'auto_approved'

    for (const vote of task.votes) {
        const addr = vote.validator.toLowerCase()
        const profile = await getValidatorProfile(addr)
        if (!profile) continue

        const votedCorrectly = isApproved
            ? vote.decision === 'approve'
            : vote.decision === 'flag'

        if (vote.decision === 'approve') profile.approvals++
        else profile.flags++

        const totalDecisions = profile.approvals + profile.flags
        const correct = votedCorrectly
            ? Math.round(profile.accuracy * (totalDecisions - 1) / 100) + 1
            : Math.round(profile.accuracy * (totalDecisions - 1) / 100)
        profile.accuracy = totalDecisions > 0 ? Math.round((correct / totalDecisions) * 100) : 100

        // FULL SLASH: one wrong vote = 100% stake gone, banned
        if (!votedCorrectly) {
            console.log(`[Validation] SLASHING validator ${addr} — voted ${vote.decision} but majority was ${isApproved ? 'approve' : 'flag'}`)
            profile.staked = 0
            profile.lockedAmount = 0
            profile.lockedOrders = []
            profile.isSlashed = true
            profile.isActive = false
        } else {
            // Release the lock for this order (correct vote)
            profile.lockedOrders = (profile.lockedOrders || []).filter(
                l => l.orderId !== task.orderId
            )
            profile.lockedAmount = profile.lockedOrders.reduce((sum, l) => sum + l.amount, 0)
        }

        await setValidatorProfile(profile)
    }
}


// ─── GET /api/validations ───────────────────────────────
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const includeResolved = searchParams.get('resolved') === 'true'

    // Run timeout checks
    await checkTimeouts()

    const tasks = await getAllValidationTasks({
        excludeAddress: address || undefined,
        includeResolved,
    })

    // Mark which ones this validator already voted on + strip large images
    const tasksWithMeta = tasks.map(t => ({
        ...t,
        evidence: {
            ...t.evidence,
            userQrImage: t.evidence.userQrImage ? '[has_image]' : undefined,
            lpScreenshot: t.evidence.lpScreenshot ? '[has_image]' : undefined,
        },
        myVote: address
            ? t.votes.find(v => v.validator.toLowerCase() === address.toLowerCase())?.decision || null
            : null,
        votesCount: t.votes.length,
        approvesCount: t.votes.filter(v => v.decision === 'approve').length,
        flagsCount: t.votes.filter(v => v.decision === 'flag').length,
    }))

    const profile = address
        ? await getValidatorProfile(address)
        : null

    return NextResponse.json({
        success: true,
        validations: tasksWithMeta,
        count: tasksWithMeta.length,
        profile,
        config: {
            threshold: FALLBACK_THRESHOLD,
            rewardPerReview: VALIDATOR_REWARD,
            timeoutMs: VALIDATION_TIMEOUT_MS,
        }
    })
}

// ─── POST /api/validations ──────────────────────────────
export async function POST(request: NextRequest) {
    const body = await request.json()

    // Get full evidence for a task
    if (body.action === 'get_detail') {
        const task = await getValidationTask(body.taskId)
        if (!task) {
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
        }
        return NextResponse.json({ success: true, validation: task })
    }

    // Vote submission
    const { taskId, validator, decision, notes } = body

    if (!taskId || !validator || !decision) {
        return NextResponse.json(
            { success: false, error: 'Missing taskId, validator, or decision' },
            { status: 400 }
        )
    }

    if (!['approve', 'flag'].includes(decision)) {
        return NextResponse.json(
            { success: false, error: 'Decision must be "approve" or "flag"' },
            { status: 400 }
        )
    }

    const task = await getValidationTask(taskId)
    if (!task) {
        return NextResponse.json(
            { success: false, error: 'Validation task not found' },
            { status: 404 }
        )
    }

    if (task.status !== 'pending') {
        return NextResponse.json(
            { success: false, error: 'Task already resolved' },
            { status: 400 }
        )
    }

    const addr = validator.toLowerCase()

    // Can't vote on own order
    if (addr === task.evidence.userAddress.toLowerCase() || addr === task.evidence.lpAddress.toLowerCase()) {
        return NextResponse.json(
            { success: false, error: 'Cannot validate your own order' },
            { status: 403 }
        )
    }

    // Can't vote twice
    if (task.votes.some(v => v.validator.toLowerCase() === addr)) {
        return NextResponse.json(
            { success: false, error: 'Already voted on this task' },
            { status: 400 }
        )
    }

    // ── Stake check: validator must be registered, not slashed, have enough available stake ──
    const validatorProfile = await getValidatorProfile(addr)
    if (!validatorProfile || !validatorProfile.isActive) {
        return NextResponse.json(
            { success: false, error: 'Not registered as DAO validator. Stake $100 USDC to join.' },
            { status: 403 }
        )
    }
    if (validatorProfile.isSlashed) {
        return NextResponse.json(
            { success: false, error: 'Your stake has been slashed. You can no longer validate.' },
            { status: 403 }
        )
    }

    // Release expired locks before checking available
    const now = Date.now()
    const activeLocks = (validatorProfile.lockedOrders || []).filter(l => l.lockedUntil > now)
    validatorProfile.lockedOrders = activeLocks
    validatorProfile.lockedAmount = activeLocks.reduce((sum, l) => sum + l.amount, 0)

    const txnAmount = task.evidence.amountUsdc
    const availableStake = validatorProfile.staked - validatorProfile.lockedAmount

    if (availableStake < txnAmount) {
        return NextResponse.json(
            { success: false, error: `Insufficient available stake. Need $${txnAmount}, available: $${availableStake.toFixed(2)}. Wait for active locks to expire.` },
            { status: 400 }
        )
    }

    // Lock the txn amount for 24hrs (dispute window)
    validatorProfile.lockedOrders.push({
        orderId: task.orderId,
        amount: txnAmount,
        lockedUntil: now + 24 * 60 * 60 * 1000,
    })
    validatorProfile.lockedAmount += txnAmount
    await setValidatorProfile(validatorProfile)

    // Record vote
    const vote: ValidationVote = {
        validator: addr,
        decision,
        notes,
        votedAt: now,
    }
    task.votes.push(vote)

    // Credit reward immediately
    await creditValidator(addr)

    console.log(`[Validation] Vote on ${taskId}: ${decision} by ${addr.slice(0, 8)}... (${task.votes.length}/${task.threshold}) — locked $${txnAmount} for 24hrs`)

    // Check if majority of all validators reached
    let resolved = false
    const approves = task.votes.filter(v => v.decision === 'approve').length
    const flags = task.votes.filter(v => v.decision === 'flag').length
    const majorityNeeded = Math.ceil(task.threshold / 2) // e.g. 3 validators → need 2, 5 → need 3

    if (approves >= majorityNeeded) {
        // Majority approved — resolve immediately
        task.status = 'approved'
        task.resolvedAt = Date.now()
        task.resolvedBy = 'dao'
        await completeOrder(task.orderId)
        resolved = true
        console.log(`[Validation] Task ${taskId} APPROVED by majority (${approves}/${task.votes.length} approves, needed ${majorityNeeded})`)
    } else if (flags >= majorityNeeded) {
        // Majority flagged — escalate immediately
        task.status = 'escalated'
        task.resolvedAt = Date.now()
        task.resolvedBy = 'dao'
        await freezeOrder(task.orderId)
        resolved = true
        console.log(`[Validation] Task ${taskId} ESCALATED by majority (${flags}/${task.votes.length} flags, needed ${majorityNeeded})`)
    }

    if (resolved) {
        await updateAccuracy(task)
    }

    await setValidationTask(task)

    return NextResponse.json({
        success: true,
        vote,
        task: {
            id: task.id,
            status: task.status,
            votesCount: task.votes.length,
            approvesCount: task.votes.filter(v => v.decision === 'approve').length,
            flagsCount: task.votes.filter(v => v.decision === 'flag').length,
            threshold: task.threshold,
            resolved,
        },
        reward: VALIDATOR_REWARD,
    })
}
