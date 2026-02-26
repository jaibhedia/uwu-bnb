import { NextRequest, NextResponse } from "next/server"
import { getOrder, setOrder, getAllOrders } from "@/lib/order-store"
import {
    type ValidationTask,
    getAllValidationTasks,
    getValidationTask,
    setValidationTask,
    getAllValidatorProfiles,
} from "@/lib/validation-store"

/**
 * Admin API — Hidden endpoint for core team
 * 
 * Admin monitors the validation pipeline and ONLY intervenes on escalated cases.
 * Normal flow: Validators approve/flag → auto-complete or escalate.
 * Admin role: Resolve escalated (flagged) cases, monitor stats, view activity log.
 * 
 * GET: Escalated cases + activity log + stats
 * POST: Resolve an escalated case (approve, slash, schedule_meet)
 */

const CORE_TEAM = (
    process.env.NEXT_PUBLIC_CORE_TEAM ||
    process.env.NEXT_PUBLIC_DAO_ADMINS ||
    "0x29E83cDc91a0E06A8180e193DF23CA3f5093017f"
).split(',').map(a => a.trim().toLowerCase())

function isAdmin(address: string): boolean {
    return CORE_TEAM.includes(address.toLowerCase())
}

// ─── GET /api/admin ─────────────────────────────────────
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')

    if (!address || !isAdmin(address)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 403 }
        )
    }

    // Fetch ALL tasks (including resolved) from Redis
    const [allTasks, allOrders, allProfiles] = await Promise.all([
        getAllValidationTasks({ includeResolved: true }),
        getAllOrders(),
        getAllValidatorProfiles(),
    ])

    // Disputed orders (raised by users — NOT from validation escalation)
    const disputedOrders = allOrders
        .filter(o => o.status === 'disputed' || o.status === 'mediation')
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(o => ({
            id: o.id,
            type: o.type,
            status: o.status,
            amountUsdc: o.amountUsdc,
            amountFiat: o.amountFiat,
            fiatCurrency: o.fiatCurrency,
            paymentMethod: o.paymentMethod,
            userAddress: o.userAddress,
            solverAddress: o.solverAddress || '',
            meetLink: o.meetLink || undefined,
            mediationScheduledAt: o.mediationScheduledAt || undefined,
            mediationEmail: o.mediationEmail || undefined,
            qrImage: o.qrImage || undefined,
            lpPaymentProof: o.lpPaymentProof || undefined,
            createdAt: o.createdAt,
            matchedAt: o.matchedAt,
            paymentSentAt: o.paymentSentAt,
            disputePeriodEndsAt: o.disputePeriodEndsAt,
        }))

    // Escalated tasks (flagged by validators, needs admin review)
    const escalated = allTasks.filter(t => t.status === 'escalated')

    // Pending tasks (being handled by validators — admin only monitors)
    const pendingCount = allTasks.filter(t => t.status === 'pending').length

    // Stats
    const stats = {
        totalValidations: allTasks.length,
        pending: pendingCount,
        approved: allTasks.filter(t => t.status === 'approved' || t.status === 'auto_approved').length,
        escalated: escalated.length,
        disputed: disputedOrders.length,
        totalValidators: allProfiles.length,
        autoApproved: allTasks.filter(t => t.status === 'auto_approved').length,
    }

    // Escalated cases with full evidence (admin can resolve these)
    const escalatedCases = await Promise.all(escalated.map(async task => ({
        ...task,
        voteBreakdown: {
            total: task.votes.length,
            approves: task.votes.filter(v => v.decision === 'approve').length,
            flags: task.votes.filter(v => v.decision === 'flag').length,
            flagReasons: task.votes
                .filter(v => v.decision === 'flag' && v.notes)
                .map(v => ({ validator: v.validator.slice(0, 10) + '...', notes: v.notes }))
        },
        order: await getOrder(task.orderId),
    })))

    // Activity log — recently resolved validations (for monitoring)
    const recentActivity = allTasks
        .filter(t => t.status !== 'pending')
        .sort((a, b) => (b.resolvedAt || b.createdAt) - (a.resolvedAt || a.createdAt))
        .slice(0, 30)
        .map(task => ({
            id: task.id,
            orderId: task.orderId,
            status: task.status,
            resolvedBy: task.resolvedBy || 'pending',
            resolvedAt: task.resolvedAt,
            createdAt: task.createdAt,
            amountUsdc: task.evidence.amountUsdc,
            votesCount: task.votes.length,
            approvesCount: task.votes.filter(v => v.decision === 'approve').length,
            flagsCount: task.votes.filter(v => v.decision === 'flag').length,
        }))

    // Top validators
    const topValidators = allProfiles
        .sort((a, b) => b.totalReviews - a.totalReviews)
        .slice(0, 20)

    // All validations sorted by creation (newest first) for monitoring
    const allValidations = allTasks
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(task => ({
            ...task,
            evidence: {
                ...task.evidence,
                // Strip large base64 images for the list view
                userQrImage: task.evidence.userQrImage ? '[has_image]' : undefined,
                lpScreenshot: task.evidence.lpScreenshot ? '[has_image]' : undefined,
            },
        }))

    return NextResponse.json({
        success: true,
        stats,
        escalatedCases,
        disputedOrders,
        recentActivity,
        topValidators,
        allValidations,
    })
}

// ─── POST /api/admin ────────────────────────────────────
export async function POST(request: NextRequest) {
    const body = await request.json()
    const { address, action, taskId, orderId, resolution, notes } = body

    if (!address || !isAdmin(address)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 403 }
        )
    }

    switch (action) {
        case 'resolve_dispute': {
            // Admin resolves a user-raised dispute on an order
            if (!orderId) {
                return NextResponse.json({ success: false, error: 'Missing orderId' }, { status: 400 })
            }
            const order = await getOrder(orderId)
            if (!order) {
                return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
            }
            if (order.status !== 'disputed' && order.status !== 'mediation') {
                return NextResponse.json({ success: false, error: 'Order is not in dispute or mediation' }, { status: 400 })
            }

            if (resolution === 'approve') {
                // Side with LP — complete the order
                const now = Date.now()
                order.status = 'completed'
                order.completedAt = now
                order.settledAt = now
                order.disputePeriodEndsAt = now + 24 * 60 * 60 * 1000
                await setOrder(order)
                console.log(`[Admin] Dispute resolved: approved order ${orderId} by ${address.slice(0, 10)}`)
                return NextResponse.json({ success: true, message: 'Dispute resolved — order completed.' })
            }

            if (resolution === 'refund') {
                // Side with user — cancel and refund
                order.status = 'cancelled'
                await setOrder(order)
                console.log(`[Admin] Dispute resolved: refunded order ${orderId} by ${address.slice(0, 10)}`)
                return NextResponse.json({ success: true, message: 'Dispute resolved — order cancelled, user refunded.' })
            }

            if (resolution === 'schedule_meet') {
                const meetLink = `https://meet.jit.si/uwu-dispute-${orderId.slice(0, 12)}-${Date.now()}`
                order.status = 'mediation'
                order.meetLink = meetLink
                order.mediationScheduledAt = Date.now()
                order.mediationEmail = 'info@abstractstudio.in'
                await setOrder(order)
                console.log(`[Admin] Mediation scheduled for disputed order ${orderId} — Meet: ${meetLink}`)
                return NextResponse.json({
                    success: true,
                    meetLink,
                    message: `Mediation room created. LP has been asked to email info@abstractstudio.in. Order status set to mediation.`,
                })
            }

            return NextResponse.json({ success: false, error: 'Invalid resolution' }, { status: 400 })
        }

        case 'resolve_validation': {
            // Admin resolves ONLY escalated cases — pending ones are for validators
            const task = await getValidationTask(taskId)
            if (!task) {
                return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
            }
            if (task.status !== 'escalated') {
                return NextResponse.json(
                    { success: false, error: task.status === 'pending' ? 'Pending tasks are handled by validators, not admin' : 'Task already resolved' },
                    { status: 400 }
                )
            }

            if (resolution === 'approve') {
                task.status = 'approved'
                task.resolvedAt = Date.now()
                task.resolvedBy = 'admin'

                const order = await getOrder(task.orderId)
                if (order && (order.status === 'verifying' || order.status === 'disputed')) {
                    const now = Date.now()
                    order.status = 'completed'
                    order.completedAt = now
                    order.settledAt = now
                    order.disputePeriodEndsAt = now + 24 * 60 * 60 * 1000
                    order.stakeLockExpiresAt = now + 24 * 60 * 60 * 1000
                    await setOrder(order)
                }
                await setValidationTask(task)
                console.log(`[Admin] Approved escalated task ${taskId} by ${address.slice(0, 10)}`)

                return NextResponse.json({
                    success: true,
                    message: 'Task approved. LP payment completed.',
                    task: { id: task.id, status: task.status }
                })
            }

            if (resolution === 'slash') {
                task.status = 'flagged'
                task.resolvedAt = Date.now()
                task.resolvedBy = 'admin'

                const order = await getOrder(task.orderId)
                if (order) {
                    order.status = 'cancelled'
                    await setOrder(order)
                }
                await setValidationTask(task)
                console.log(`[Admin] Slashed LP for task ${taskId} by ${address.slice(0, 10)}`)

                return NextResponse.json({
                    success: true,
                    message: 'LP slashed. Order cancelled. User USDC returned.',
                    task: { id: task.id, status: task.status }
                })
            }

            if (resolution === 'schedule_meet') {
                console.log(`[Admin] Scheduled meeting for task ${taskId} — notes: ${notes}`)
                return NextResponse.json({
                    success: true,
                    message: 'Meeting scheduled. Both parties will be notified.',
                })
            }

            return NextResponse.json({ success: false, error: 'Invalid resolution type' }, { status: 400 })
        }

        default:
            return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
    }
}
