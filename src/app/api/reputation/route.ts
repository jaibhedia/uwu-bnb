import { NextRequest, NextResponse } from 'next/server'

/**
 * Reputation/Trust Score API
 * Calculates merchant trust scores based on transaction history
 * In production, this would query on-chain transaction logs
 */

interface TransactionRecord {
    orderId: string
    merchantAddress: string
    status: 'completed' | 'disputed' | 'cancelled'
    completionTime?: number
    createdAt: number
}

interface ReputationData {
    address: string
    trustScore: number
    totalTrades: number
    successfulTrades: number
    disputedTrades: number
    averageCompletionTime: number
    responseRate: number
    lastUpdated: number
}

// Mock transaction data (In production, query from chain)
const mockTransactions: Record<string, TransactionRecord[]> = {
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb': [
        ...Array(1247).fill(null).map((_, i) => ({
            orderId: `order_${i}`,
            merchantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
            status: (i % 50 === 0 ? 'disputed' : 'completed') as 'completed' | 'disputed' | 'cancelled',
            createdAt: Date.now() - (i * 3600000),
            completionTime: 120000, // 2 minutes
        })),
    ],
    '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199': [
        ...Array(892).fill(null).map((_, i) => ({
            orderId: `order_${i}`,
            merchantAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
            status: (i % 40 === 0 ? 'disputed' : 'completed') as 'completed' | 'disputed' | 'cancelled',
            createdAt: Date.now() - (i * 3600000),
            completionTime: 180000, // 3 minutes
        })),
    ],
    '0xdD2FD4581271e230360230F9337D5c0430Bf44C0': [
        ...Array(456).fill(null).map((_, i) => ({
            orderId: `order_${i}`,
            merchantAddress: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
            status: (i % 30 === 0 ? 'disputed' : 'completed') as 'completed' | 'disputed' | 'cancelled',
            createdAt: Date.now() - (i * 3600000),
            completionTime: 300000, // 5 minutes
        })),
    ],
}

/**
 * Calculate trust score based on transaction history
 * Formula: (successful_trades / total_trades) * 100
 * Penalties for disputes and slow completion times
 */
function calculateTrustScore(transactions: TransactionRecord[]): ReputationData {
    const totalTrades = transactions.length
    const successfulTrades = transactions.filter(t => t.status === 'completed').length
    const disputedTrades = transactions.filter(t => t.status === 'disputed').length
    const cancelledTrades = transactions.filter(t => t.status === 'cancelled').length

    // Base score from success rate
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) : 0
    let trustScore = successRate * 100

    // Penalty for disputes (each dispute reduces score by 0.5%)
    trustScore -= (disputedTrades / totalTrades) * 50

    // Penalty for cancellations (each cancellation reduces score by 0.2%)
    trustScore -= (cancelledTrades / totalTrades) * 20

    // Bonus for high volume (>1000 trades get +2%, >500 get +1%)
    if (totalTrades > 1000) trustScore += 2
    else if (totalTrades > 500) trustScore += 1

    // Cap between 0-100
    trustScore = Math.max(0, Math.min(100, trustScore))

    // Calculate average completion time
    const completedTxs = transactions.filter(t => t.status === 'completed' && t.completionTime)
    const averageCompletionTime = completedTxs.length > 0
        ? completedTxs.reduce((sum, t) => sum + (t.completionTime || 0), 0) / completedTxs.length
        : 0

    // Response rate (assuming all transactions were responded to for mock)
    const responseRate = 100

    return {
        address: transactions[0]?.merchantAddress || '',
        trustScore: Math.round(trustScore),
        totalTrades,
        successfulTrades,
        disputedTrades,
        averageCompletionTime,
        responseRate,
        lastUpdated: Date.now(),
    }
}

/**
 * GET /api/reputation?address=0x...
 * Returns reputation data for a merchant
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const address = searchParams.get('address')

        if (!address) {
            return NextResponse.json(
                { error: 'Address parameter required' },
                { status: 400 }
            )
        }

        // Get transactions for this merchant (from opBNB in production)
        const transactions = mockTransactions[address] || []

        if (transactions.length === 0) {
            // New merchant with no history
            return NextResponse.json({
                address,
                trustScore: 0,
                totalTrades: 0,
                successfulTrades: 0,
                disputedTrades: 0,
                averageCompletionTime: 0,
                responseRate: 0,
                lastUpdated: Date.now(),
            })
        }

        // Calculate reputation
        const reputation = calculateTrustScore(transactions)

        return NextResponse.json(reputation)
    } catch (error) {
        console.error('Reputation API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/reputation
 * Updates reputation after a transaction completes
 * Body: { merchantAddress, orderId, status, completionTime }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { merchantAddress, orderId, status, completionTime } = body

        if (!merchantAddress || !orderId || !status) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // In production: Write transaction record to opBNB blockchain
        // For now, just acknowledge
        console.log('Reputation update:', { merchantAddress, orderId, status, completionTime })

        // Return updated reputation
        const transactions = mockTransactions[merchantAddress] || []
        const reputation = calculateTrustScore(transactions)

        return NextResponse.json({
            success: true,
            reputation,
        })
    } catch (error) {
        console.error('Reputation update error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
