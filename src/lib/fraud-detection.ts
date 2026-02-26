/**
 * Fraud Detection Engine
 * Behavioral analysis for P2P trade risk assessment
 */

import { PLATFORM_CONFIG, getRiskLevel, calculateRequiredStake, type RiskLevel } from './platform-config'

/**
 * Fraud signals collected for analysis
 */
export interface FraudSignals {
    // Velocity metrics
    ordersLastHour: number
    ordersLast24h: number

    // Pattern metrics
    amountEscalation: number        // Ratio of current to avg order amount
    isRoundNumber: boolean

    // Wallet metrics
    walletAgeHours: number
    completedOrders: number
    totalVolume: number
    disputeRate: number

    // Session metrics
    newDevice: boolean
    geoMismatch: boolean            // IP country != payment country

    // Timing
    currentHour: number
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
    riskScore: number
    riskLevel: RiskLevel
    requiredActions: RequiredAction[]
    maxOrderAmount: number
    requiredStake: number
    blocked: boolean
    signals: Partial<FraudSignals>
}

export type RequiredAction =
    | 'NORMAL_STAKE'
    | 'REQUIRE_HIGHER_STAKE'
    | 'MANUAL_REVIEW'
    | 'DELAYED_RELEASE'
    | 'BLOCK_ORDER'
    | 'FLAG_ACCOUNT'

/**
 * Order data for risk analysis
 */
export interface OrderAnalysisData {
    amountUsdc: number
    paymentMethod: string
    fiatCurrency: string
    userAddress: string
    ipAddress?: string
    deviceId?: string
}

/**
 * User history for risk calculation
 */
export interface UserHistory {
    ordersLastHour: number
    ordersLast24h: number
    averageOrderAmount: number
    completedOrders: number
    totalVolume: number
    disputeCount: number
    walletCreatedAt: number
    lastDeviceId?: string
    lastIpCountry?: string
}

/**
 * Fraud Detector Class
 * Analyzes trade data and user history to assess risk
 */
export class FraudDetector {
    private config = PLATFORM_CONFIG.fraud

    /**
     * Analyze a trade for fraud risk
     */
    async analyzeTrade(
        orderData: OrderAnalysisData,
        userHistory: UserHistory
    ): Promise<RiskAssessment> {
        const signals = this.gatherSignals(orderData, userHistory)
        const riskScore = this.calculateRiskScore(signals, orderData)
        const riskLevel = getRiskLevel(riskScore)
        const requiredActions = this.getRequiredActions(riskScore)
        const maxOrderAmount = this.calculateMaxAmount(riskScore, userHistory)
        const requiredStake = calculateRequiredStake(orderData.amountUsdc, riskScore)

        return {
            riskScore,
            riskLevel,
            requiredActions,
            maxOrderAmount,
            requiredStake,
            blocked: requiredActions.includes('BLOCK_ORDER'),
            signals,
        }
    }

    /**
     * Gather fraud signals from order and history data
     */
    private gatherSignals(
        orderData: OrderAnalysisData,
        history: UserHistory
    ): FraudSignals {
        const now = new Date()
        const walletAgeHours = history.walletCreatedAt
            ? (Date.now() - history.walletCreatedAt) / (1000 * 60 * 60)
            : 0

        return {
            // Velocity
            ordersLastHour: history.ordersLastHour,
            ordersLast24h: history.ordersLast24h,

            // Patterns
            amountEscalation: history.averageOrderAmount > 0
                ? orderData.amountUsdc / history.averageOrderAmount
                : 1,
            isRoundNumber: orderData.amountUsdc % this.config.roundNumberThreshold === 0,

            // Wallet
            walletAgeHours,
            completedOrders: history.completedOrders,
            totalVolume: history.totalVolume,
            disputeRate: history.completedOrders > 0
                ? history.disputeCount / history.completedOrders
                : 0,

            // Session
            newDevice: history.lastDeviceId !== undefined &&
                orderData.deviceId !== history.lastDeviceId,
            geoMismatch: history.lastIpCountry !== undefined &&
                orderData.ipAddress !== undefined &&
                this.checkGeoMismatch(orderData.ipAddress, orderData.fiatCurrency),

            // Timing
            currentHour: now.getHours(),
        }
    }

    /**
     * Calculate risk score from signals (0-100)
     */
    private calculateRiskScore(
        signals: FraudSignals,
        orderData: OrderAnalysisData
    ): number {
        let score = 0

        // Velocity checks (max 40 points)
        if (signals.ordersLastHour > this.config.maxOrdersPerHour) {
            score += 25
        } else if (signals.ordersLastHour > this.config.maxOrdersPerHour / 2) {
            score += 10
        }

        if (signals.ordersLast24h > this.config.maxOrdersPerDay) {
            score += 15
        } else if (signals.ordersLast24h > this.config.maxOrdersPerDay / 2) {
            score += 5
        }

        // Amount pattern checks (max 30 points)
        if (signals.amountEscalation > this.config.amountEscalationThreshold) {
            score += 20
        } else if (signals.amountEscalation > this.config.amountEscalationThreshold / 2) {
            score += 10
        }

        if (signals.isRoundNumber) {
            score += 10
        }

        // Wallet age check (max 15 points)
        if (signals.walletAgeHours < this.config.newWalletAgeHours) {
            const ageFactor = 1 - (signals.walletAgeHours / this.config.newWalletAgeHours)
            score += Math.round(15 * ageFactor)
        }

        // Device/session checks (max 20 points)
        if (signals.newDevice) {
            score += 10
        }
        if (signals.geoMismatch) {
            score += 20
        }

        // Time anomaly check (max 15 points)
        if (
            signals.currentHour >= this.config.suspiciousHoursStart &&
            signals.currentHour <= this.config.suspiciousHoursEnd
        ) {
            score += 15
        }

        // Payment method risk adjustment
        const paymentMethod = PLATFORM_CONFIG.paymentMethods.find(
            m => m.id === orderData.paymentMethod || m.name === orderData.paymentMethod
        )
        if (paymentMethod) {
            score += Math.round(paymentMethod.riskScore / 5) // Max +10 points
        }

        // Trust discount for established users
        if (signals.completedOrders > 100) {
            score = Math.max(0, score - 20)
        } else if (signals.completedOrders > 50) {
            score = Math.max(0, score - 15)
        } else if (signals.completedOrders > 20) {
            score = Math.max(0, score - 10)
        }

        // High dispute rate penalty
        if (signals.disputeRate > 0.1) {
            score += 25
        } else if (signals.disputeRate > 0.05) {
            score += 15
        }

        return Math.min(100, Math.max(0, score))
    }

    /**
     * Get required actions based on risk score
     */
    private getRequiredActions(score: number): RequiredAction[] {
        const actions: RequiredAction[] = []

        if (score < 20) {
            actions.push('NORMAL_STAKE')
            return actions
        }

        if (score >= 20) {
            actions.push('REQUIRE_HIGHER_STAKE')
        }
        if (score >= 40) {
            actions.push('MANUAL_REVIEW')
        }
        if (score >= 50) {
            actions.push('DELAYED_RELEASE')
        }
        if (score >= 70) {
            actions.push('BLOCK_ORDER')
            actions.push('FLAG_ACCOUNT')
        }

        return actions
    }

    /**
     * Calculate maximum allowed order amount based on risk
     */
    private calculateMaxAmount(score: number, history: UserHistory): number {
        const { orders } = PLATFORM_CONFIG
        const baseLimit = orders.maxAmountUSDC

        // Trust multiplier (more trades = higher limit)
        const trustMultiplier = Math.min(2, 1 + (history.completedOrders / 100))

        // Risk penalty (higher score = lower limit)
        const riskPenalty = 1 - (score / 100)

        const maxAmount = baseLimit * trustMultiplier * riskPenalty

        return Math.max(orders.minAmountUSDC, Math.round(maxAmount))
    }

    /**
     * Check for geographic mismatch
     * In production, use IP geolocation service
     */
    private checkGeoMismatch(ipAddress: string, fiatCurrency: string): boolean {
        // Simplified check - in production, use MaxMind or similar
        const currencyToCountry: Record<string, string[]> = {
            INR: ['IN'],
            USD: ['US'],
            BRL: ['BR'],
            EUR: ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI'],
        }

        // For now, return false (no mismatch detected)
        // In production, geolocate IP and compare
        return false
    }
}

/**
 * Create a default fraud detector instance
 */
export function createFraudDetector(): FraudDetector {
    return new FraudDetector()
}

/**
 * Quick risk check for UI feedback
 * Returns a simplified risk level without full analysis
 */
export function quickRiskCheck(
    amountUsdc: number,
    completedOrders: number,
    walletAgeHours: number
): RiskLevel {
    let score = 0

    // New wallet
    if (walletAgeHours < PLATFORM_CONFIG.fraud.newWalletAgeHours) {
        score += 15
    }

    // No history
    if (completedOrders === 0) {
        score += 20
    }

    // Large amount for new user
    if (amountUsdc > 500 && completedOrders < 5) {
        score += 15
    }

    // Very large amount
    if (amountUsdc > 5000) {
        score += 10
    }

    return getRiskLevel(score)
}
