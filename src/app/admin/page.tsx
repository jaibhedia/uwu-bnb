"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    Shield, ShieldAlert, AlertTriangle, CheckCircle, XCircle,
    Loader2, Users, DollarSign, Clock, ThumbsUp, ThumbsDown,
    RefreshCw, Ban, Calendar, TrendingUp, Activity, Copy,
    User, Wallet, Settings, LogOut, ClipboardCheck, Eye,
    ChevronRight, ExternalLink, ImageIcon
} from "lucide-react"
import { useWallet } from "@/hooks/useWallet"
import { Badge } from "@/components/ui/badge"
import { WalletConnect } from "@/components/app/wallet-connect"

/**
 * Admin Panel — /admin
 * 
 * Outside (app) layout group — no bottom nav.
 * Wallet-gated: only NEXT_PUBLIC_CORE_TEAM addresses.
 * 
 * Admin monitors and only intervenes on escalated cases.
 * Normal validations are handled by DAO validators.
 * 
 * Tabs: Profile, Wallet, Escalated, Activity Log, Validators
 */

const CORE_TEAM = (
    process.env.NEXT_PUBLIC_CORE_TEAM ||
    "0x8889A923bc9EA775b387eAd56e21DCD351Cad618"
).split(',').map(a => a.trim().toLowerCase())

interface ValidationTask {
    id: string
    orderId: string
    status: 'pending' | 'approved' | 'flagged' | 'escalated' | 'auto_approved'
    evidence: {
        userQrImage?: string
        userAddress: string
        lpScreenshot?: string
        lpAddress: string
        amountUsdc: number
        amountFiat: number
        fiatCurrency: string
        paymentMethod: string
    }
    votes: { validator: string; decision: string; notes?: string; votedAt: number }[]
    threshold: number
    createdAt: number
    deadline: number
    resolvedAt?: number
    resolvedBy?: string
}

interface EscalatedCase {
    id: string
    orderId: string
    status: string
    evidence: {
        userQrImage?: string
        userAddress: string
        lpScreenshot?: string
        lpAddress: string
        amountUsdc: number
        amountFiat: number
        fiatCurrency: string
        paymentMethod: string
    }
    votes: { validator: string; decision: string; notes?: string; votedAt: number }[]
    voteBreakdown: {
        total: number
        approves: number
        flags: number
        flagReasons: { validator: string; notes?: string }[]
    }
    createdAt: number
    deadline: number
    order: any
}

interface ActivityEntry {
    id: string
    orderId: string
    status: string
    resolvedBy: string
    resolvedAt?: number
    createdAt: number
    amountUsdc: number
    votesCount: number
    approvesCount: number
    flagsCount: number
}

interface Stats {
    totalValidations: number
    pending: number
    approved: number
    escalated: number
    totalValidators: number
    autoApproved: number
}

interface ValidatorInfo {
    address: string
    totalReviews: number
    totalEarned: number
    approvals: number
    flags: number
    accuracy: number
}

export default function AdminPage() {
    const { isConnected, address, disconnect } = useWallet()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [stats, setStats] = useState<Stats | null>(null)
    const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([])
    const [escalatedCases, setEscalatedCases] = useState<EscalatedCase[]>([])
    const [topValidators, setTopValidators] = useState<ValidatorInfo[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [resolving, setResolving] = useState(false)
    const [copied, setCopied] = useState(false)
    const [allValidations, setAllValidations] = useState<ValidationTask[]>([])
    const [disputedOrders, setDisputedOrders] = useState<any[]>([])
    const [revenueData, setRevenueData] = useState<any>(null)
    const [revenueLoading, setRevenueLoading] = useState(false)
    const [tab, setTab] = useState<'profile' | 'wallet' | 'monitor' | 'disputes' | 'activity' | 'validators' | 'revenue'>('monitor')

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (address) {
            setIsAuthorized(CORE_TEAM.includes(address.toLowerCase()))
        }
    }, [address])

    const fetchData = useCallback(async () => {
        if (!address || !isAuthorized) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/admin?address=${address}`)
            const data = await res.json()
            if (data.success) {
                setStats(data.stats)
                setRecentActivity(data.recentActivity || [])
                setEscalatedCases(data.escalatedCases || [])
                setTopValidators(data.topValidators || [])
                setAllValidations(data.allValidations || [])
                setDisputedOrders(data.disputedOrders || [])
            }
        } catch (err) {
            console.error('Failed to fetch admin data:', err)
        } finally {
            setIsLoading(false)
        }
    }, [address, isAuthorized])

    useEffect(() => {
        if (isAuthorized) {
            fetchData()
            const interval = setInterval(fetchData, 15000)
            return () => clearInterval(interval)
        }
    }, [isAuthorized, fetchData])

    // Fetch revenue data when tab is selected
    useEffect(() => {
        if (tab === 'revenue' && address && isAuthorized && !revenueData) {
            setRevenueLoading(true)
            fetch(`/api/admin/revenue?address=${address}`)
                .then(r => r.json())
                .then(data => { if (data.success) setRevenueData(data) })
                .catch(console.error)
                .finally(() => setRevenueLoading(false))
        }
    }, [tab, address, isAuthorized, revenueData])

    const resolveDispute = async (orderId: string, resolution: 'approve' | 'refund' | 'schedule_meet') => {
        if (!address) return
        setResolving(true)
        try {
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    action: 'resolve_dispute',
                    orderId,
                    resolution,
                })
            })
            const data = await res.json()
            if (data.success) {
                if (data.meetLink) {
                    window.open(data.meetLink, '_blank')
                }
                fetchData()
            } else {
                alert(data.error || 'Failed to resolve dispute')
            }
        } catch (err) {
            alert('Network error')
        } finally {
            setResolving(false)
        }
    }

    const resolveCase = async (taskId: string, resolution: 'approve' | 'slash' | 'schedule_meet') => {
        if (!address) return
        setResolving(true)
        try {
            const res = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    action: 'resolve_validation',
                    taskId,
                    resolution,
                })
            })
            const data = await res.json()
            if (data.success) {
                fetchData()
            } else {
                alert(data.error || 'Failed')
            }
        } catch (err) {
            alert('Network error')
        } finally {
            setResolving(false)
        }
    }

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleLogout = () => {
        disconnect()
        router.push('/')
    }

    if (!mounted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        )
    }

    // Gate: not connected
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-surface border border-brand/30 p-8 text-center max-w-md">
                    <Shield className="w-16 h-16 text-brand mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-text-primary mb-2 font-mono uppercase">Admin Access</h1>
                    <p className="text-text-secondary mb-6 text-sm">Core team wallet required.</p>
                    <WalletConnect />
                </div>
            </div>
        )
    }

    // Gate: not authorized
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="bg-surface border border-red-500/30 p-8 text-center max-w-md">
                    <Ban className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-red-400 mb-2 font-mono">UNAUTHORIZED</h1>
                    <p className="text-text-secondary text-sm mb-2">
                        Wallet <span className="font-mono text-brand">{address?.slice(0, 10)}...</span> is not in the core team list.
                    </p>
                    <p className="text-text-secondary text-xs">
                        Contact the team lead to get your wallet whitelisted.
                    </p>
                </div>
            </div>
        )
    }

    const alertCount = disputedOrders.length

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-brand/20 p-4 sticky top-0 bg-background/95 backdrop-blur-md z-10">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand/10 border border-brand/30 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-brand" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white font-mono uppercase">Admin</h1>
                            <p className="text-[10px] text-brand/80 uppercase tracking-wider font-mono">
                                Core Team &bull; {address?.slice(0, 8)}...{address?.slice(-4)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {alertCount > 0 && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 font-mono">
                                {alertCount} alert{alertCount > 1 ? 's' : ''}
                            </span>
                        )}
                        <button
                            onClick={fetchData}
                            className="p-2 text-text-secondary hover:text-brand transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-border pb-2 overflow-x-auto">
                    {[
                        { key: 'revenue', label: 'Revenue', icon: <DollarSign className="w-3 h-3" /> },
                        { key: 'monitor', label: 'Monitor', icon: <ClipboardCheck className="w-3 h-3" />, count: allValidations.filter(v => v.status === 'pending').length },
                        { key: 'disputes', label: 'Disputes', icon: <ShieldAlert className="w-3 h-3" />, count: disputedOrders.length },
                        { key: 'activity', label: 'Activity', icon: <Activity className="w-3 h-3" />, count: recentActivity.length },
                        { key: 'validators', label: 'Validators', icon: <Users className="w-3 h-3" />, count: topValidators.length },
                        { key: 'profile', label: 'Profile', icon: <User className="w-3 h-3" /> },
                        { key: 'wallet', label: 'Wallet', icon: <Wallet className="w-3 h-3" /> },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key as typeof tab)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.key
                                ? 'text-brand border-b-2 border-brand'
                                : 'text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            {t.icon}
                            {t.label}
                            {'count' in t && (t as any).count > 0 && (
                                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                                    {(t as any).count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {isLoading && tab !== 'profile' && tab !== 'wallet' && tab !== 'revenue' ? (
                    <div className="p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto" />
                    </div>
                ) : (
                    <>
                        {/* ===== REVENUE TAB ===== */}
                        {tab === 'revenue' && (
                            <div className="space-y-4">
                                {revenueLoading ? (
                                    <div className="p-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-2" />
                                        <p className="text-text-secondary text-sm">Loading revenue data...</p>
                                    </div>
                                ) : !revenueData ? (
                                    <div className="bg-surface border border-border p-8 text-center">
                                        <DollarSign className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                                        <h3 className="font-bold text-text-primary mb-2">No Data</h3>
                                        <button onClick={() => {
                                            setRevenueLoading(true)
                                            fetch(`/api/admin/revenue?address=${address}`)
                                                .then(r => r.json())
                                                .then(data => { if (data.success) setRevenueData(data) })
                                                .catch(console.error)
                                                .finally(() => setRevenueLoading(false))
                                        }} className="text-brand text-sm hover:underline">Retry</button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Fee Collector */}
                                        <div className="bg-gradient-to-br from-green-900/20 to-brand/10 border border-green-500/20 p-6">
                                            <div className="text-xs text-text-secondary uppercase font-mono mb-1">Fee Collector (Contract Owner)</div>
                                            <div className="text-3xl font-bold text-green-400 font-mono mb-1">
                                                ${revenueData.revenue.totalFees.toFixed(4)}
                                            </div>
                                            <div className="text-xs text-text-secondary">
                                                Total estimated fees from {revenueData.orders.completed} completed orders
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-green-500/20 text-xs font-mono text-text-secondary break-all">
                                                {revenueData.feeCollector}
                                            </div>
                                            <div className="mt-1 text-[10px] text-yellow-400/80">
                                                ⚠ Fees go to contract owner() via releaseEscrow — 0.5% per trade
                                            </div>
                                        </div>

                                        {/* Revenue breakdown */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-surface border border-green-500/20 p-4">
                                                <div className="text-xs text-text-secondary mb-1">Protocol Fees (0.5%)</div>
                                                <div className="text-xl font-bold text-green-400 font-mono">
                                                    ${revenueData.revenue.protocolFees.toFixed(4)}
                                                </div>
                                            </div>
                                            <div className="bg-surface border border-blue-500/20 p-4">
                                                <div className="text-xs text-text-secondary mb-1">Small Order Fees</div>
                                                <div className="text-xl font-bold text-blue-400 font-mono">
                                                    ${revenueData.revenue.smallOrderFees.toFixed(4)}
                                                </div>
                                            </div>
                                            <div className="bg-surface border border-yellow-500/20 p-4">
                                                <div className="text-xs text-text-secondary mb-1">Validator Payouts</div>
                                                <div className="text-xl font-bold text-yellow-400 font-mono">
                                                    -${revenueData.revenue.validatorPayouts.toFixed(4)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Net revenue */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-surface border border-border p-4">
                                                <div className="text-xs text-text-secondary mb-1">Total Volume</div>
                                                <div className="text-2xl font-bold text-text-primary font-mono">
                                                    ${revenueData.revenue.totalVolume.toFixed(2)}
                                                </div>
                                                <div className="text-[10px] text-text-secondary">USDC traded</div>
                                            </div>
                                            <div className="bg-surface border border-brand/30 p-4">
                                                <div className="text-xs text-text-secondary mb-1">Net Revenue</div>
                                                <div className={`text-2xl font-bold font-mono ${revenueData.revenue.netRevenue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    ${revenueData.revenue.netRevenue.toFixed(4)}
                                                </div>
                                                <div className="text-[10px] text-text-secondary">Fees - Validator payouts</div>
                                            </div>
                                        </div>

                                        {/* 7-day volume chart */}
                                        <div className="bg-surface border border-border p-4">
                                            <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-brand" />
                                                7-Day Volume
                                            </h3>
                                            <div className="space-y-2">
                                                {revenueData.dailyVolume.map((day: any) => {
                                                    const maxVol = Math.max(...revenueData.dailyVolume.map((d: any) => d.volume || 1))
                                                    const barWidth = maxVol > 0 ? (day.volume / maxVol) * 100 : 0
                                                    return (
                                                        <div key={day.date} className="flex items-center gap-3">
                                                            <span className="text-text-secondary font-mono text-xs w-16">{day.date.slice(5)}</span>
                                                            <div className="flex-1 bg-background rounded-full h-4 overflow-hidden">
                                                                <div
                                                                    className="bg-brand/60 h-full rounded-full transition-all"
                                                                    style={{ width: `${barWidth}%` }}
                                                                />
                                                            </div>
                                                            <div className="text-right w-28">
                                                                <span className="text-text-primary font-mono text-xs">${day.volume.toFixed(2)}</span>
                                                                <span className="text-text-secondary text-[10px] ml-1">({day.orders})</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Order stats */}
                                        <div className="bg-surface border border-border p-4">
                                            <h3 className="text-sm font-bold text-text-primary mb-3">Order Breakdown</h3>
                                            <div className="grid grid-cols-4 gap-2 mb-3">
                                                <div className="text-center">
                                                    <div className="text-xl font-bold text-text-primary font-mono">{revenueData.orders.total}</div>
                                                    <div className="text-[10px] text-text-secondary uppercase">Total</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xl font-bold text-green-400 font-mono">{revenueData.orders.completed}</div>
                                                    <div className="text-[10px] text-text-secondary uppercase">Completed</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xl font-bold text-yellow-400 font-mono">{revenueData.orders.pending}</div>
                                                    <div className="text-[10px] text-text-secondary uppercase">Pending</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xl font-bold text-red-400 font-mono">{revenueData.orders.failed}</div>
                                                    <div className="text-[10px] text-text-secondary uppercase">Failed</div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
                                                {Object.entries(revenueData.orders.statusBreakdown).map(([status, count]: [string, any]) => (
                                                    <span key={status} className="px-2 py-0.5 bg-background border border-border text-[10px] font-mono text-text-secondary">
                                                        {status}: {count}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Recent orders with fees */}
                                        <div className="bg-surface border border-border p-4">
                                            <h3 className="text-sm font-bold text-text-primary mb-3">Recent Orders</h3>
                                            <div className="space-y-1.5 max-h-80 overflow-y-auto">
                                                {revenueData.recentOrders.map((order: any) => (
                                                    <div key={order.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${order.status === 'completed' || order.status === 'settled' ? 'bg-green-500' :
                                                            order.status === 'cancelled' || order.status === 'expired' ? 'bg-red-500' :
                                                                'bg-yellow-500'
                                                            }`} />
                                                        <span className="text-brand font-mono w-20 truncate">{order.id.slice(0, 10)}</span>
                                                        <span className="text-text-primary font-mono w-16">${order.amountUsdc.toFixed(2)}</span>
                                                        <Badge className={`text-[9px] px-1 py-0 ${order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                            order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                                                'bg-yellow-500/20 text-yellow-400'
                                                            }`}>{order.status}</Badge>
                                                        {order.fee > 0 && (
                                                            <span className="ml-auto text-green-400 font-mono">+${order.fee.toFixed(4)}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Validator payout stats */}
                                        <div className="bg-surface border border-border p-4">
                                            <h3 className="text-sm font-bold text-text-primary mb-3">Validation Stats</h3>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-text-primary font-mono">{revenueData.validationStats.totalVotes}</div>
                                                    <div className="text-[10px] text-text-secondary">Total Votes</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-green-400 font-mono">{revenueData.validationStats.approved}</div>
                                                    <div className="text-[10px] text-text-secondary">Approved</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-lg font-bold text-yellow-400 font-mono">${revenueData.validationStats.totalValidatorPayouts.toFixed(2)}</div>
                                                    <div className="text-[10px] text-text-secondary">Paid Out</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Refresh */}
                                        <button
                                            onClick={() => {
                                                setRevenueData(null)
                                                setRevenueLoading(true)
                                                fetch(`/api/admin/revenue?address=${address}`)
                                                    .then(r => r.json())
                                                    .then(data => { if (data.success) setRevenueData(data) })
                                                    .catch(console.error)
                                                    .finally(() => setRevenueLoading(false))
                                            }}
                                            className="w-full py-2 text-sm text-text-secondary hover:text-brand border border-border hover:border-brand transition-colors flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Refresh Revenue Data
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ===== VALIDATION MONITOR TAB ===== */}
                        {tab === 'monitor' && (
                            <div className="space-y-4">
                                {/* Summary stats row */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 text-center">
                                        <div className="text-xl font-bold text-yellow-400 font-mono">{allValidations.filter(v => v.status === 'pending').length}</div>
                                        <div className="text-[10px] text-text-secondary uppercase">Pending</div>
                                    </div>
                                    <div className="bg-green-500/10 border border-green-500/20 p-3 text-center">
                                        <div className="text-xl font-bold text-green-400 font-mono">{allValidations.filter(v => v.status === 'approved').length}</div>
                                        <div className="text-[10px] text-text-secondary uppercase">Approved</div>
                                    </div>
                                    <div className="bg-red-500/10 border border-red-500/20 p-3 text-center">
                                        <div className="text-xl font-bold text-red-400 font-mono">{allValidations.filter(v => v.status === 'escalated').length}</div>
                                        <div className="text-[10px] text-text-secondary uppercase">Escalated</div>
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                                        <div className="text-xl font-bold text-blue-400 font-mono">{allValidations.filter(v => v.status === 'auto_approved').length}</div>
                                        <div className="text-[10px] text-text-secondary uppercase">Auto</div>
                                    </div>
                                </div>

                                {/* All validations list */}
                                {allValidations.length === 0 ? (
                                    <div className="bg-surface border border-border p-8 text-center">
                                        <ClipboardCheck className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                                        <h3 className="font-bold text-text-primary mb-2">No Validations Yet</h3>
                                        <p className="text-text-secondary text-sm">Orders entering verification will appear here.</p>
                                    </div>
                                ) : (
                                    allValidations.map(task => (
                                        <div key={task.id} className={`bg-surface border p-4 ${task.status === 'pending' ? 'border-yellow-500/30' :
                                            task.status === 'escalated' ? 'border-red-500/30' :
                                                task.status === 'approved' ? 'border-green-500/30' :
                                                    task.status === 'auto_approved' ? 'border-blue-500/30' :
                                                        'border-border'
                                            }`}>
                                            {/* Header row */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-brand">#{task.orderId.slice(0, 12)}</span>
                                                        <span className="text-[10px] text-text-secondary font-mono">{task.id}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-lg font-bold text-text-primary">${task.evidence.amountUsdc.toFixed(2)}</span>
                                                        <span className="text-xs text-text-secondary">&asymp; {task.evidence.fiatCurrency} {task.evidence.amountFiat.toFixed(0)}</span>
                                                    </div>
                                                </div>
                                                <Badge className={`text-[10px] ${task.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    task.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                                        task.status === 'escalated' ? 'bg-red-500/20 text-red-400' :
                                                            task.status === 'auto_approved' ? 'bg-blue-500/20 text-blue-400' :
                                                                'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {task.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                                    {task.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                                                    {task.status === 'escalated' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                    {task.status === 'auto_approved' && <Clock className="w-3 h-3 mr-1" />}
                                                    {task.status.replace('_', ' ')}
                                                </Badge>
                                            </div>

                                            {/* Vote progress bar */}
                                            <div className="mb-3">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-text-secondary">Votes</span>
                                                    <span className="text-text-primary font-mono">{task.votes.length}/{task.threshold}</span>
                                                </div>
                                                <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all rounded-full ${task.votes.length >= task.threshold ? 'bg-green-500' :
                                                            task.votes.length > 0 ? 'bg-yellow-500' : 'bg-gray-600'
                                                            }`}
                                                        style={{ width: `${Math.min((task.votes.length / task.threshold) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                {task.votes.length > 0 && (
                                                    <div className="flex gap-3 mt-1 text-xs">
                                                        <span className="text-green-400">
                                                            <ThumbsUp className="w-3 h-3 inline mr-0.5" />
                                                            {task.votes.filter(v => v.decision === 'approve').length}
                                                        </span>
                                                        <span className="text-red-400">
                                                            <ThumbsDown className="w-3 h-3 inline mr-0.5" />
                                                            {task.votes.filter(v => v.decision === 'flag').length}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Individual votes */}
                                            {task.votes.length > 0 && (
                                                <div className="bg-background border border-border rounded p-3 mb-3">
                                                    <div className="text-[10px] text-text-secondary uppercase mb-2">Validator Votes</div>
                                                    <div className="space-y-1.5">
                                                        {task.votes.map((vote, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                                {vote.decision === 'approve' ? (
                                                                    <ThumbsUp className="w-3 h-3 text-green-400 flex-shrink-0" />
                                                                ) : (
                                                                    <ThumbsDown className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                                )}
                                                                <span className="font-mono text-text-primary">{vote.validator.slice(0, 8)}...{vote.validator.slice(-4)}</span>
                                                                {vote.notes && (
                                                                    <span className="text-text-secondary truncate">&mdash; {vote.notes}</span>
                                                                )}
                                                                <span className="ml-auto text-text-secondary text-[10px] flex-shrink-0">
                                                                    {new Date(vote.votedAt).toLocaleTimeString()}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Addresses & metadata */}
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-text-secondary">Buyer: </span>
                                                    <span className="font-mono text-text-primary">{task.evidence.userAddress.slice(0, 8)}...{task.evidence.userAddress.slice(-4)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-text-secondary">LP: </span>
                                                    <span className="font-mono text-text-primary">{task.evidence.lpAddress.slice(0, 8)}...{task.evidence.lpAddress.slice(-4)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-text-secondary">Created: </span>
                                                    <span className="text-text-primary">{new Date(task.createdAt).toLocaleString()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-text-secondary">{task.resolvedAt ? 'Resolved: ' : 'Deadline: '}</span>
                                                    <span className="text-text-primary">
                                                        {task.resolvedAt
                                                            ? new Date(task.resolvedAt).toLocaleString()
                                                            : new Date(task.deadline).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Resolved by */}
                                            {task.resolvedBy && (
                                                <div className="mt-2 pt-2 border-t border-border text-xs text-text-secondary">
                                                    Resolved by: <span className="text-brand font-mono">{task.resolvedBy}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ===== PROFILE TAB ===== */}
                        {tab === 'profile' && (
                            <div className="space-y-4">
                                {/* Admin identity card */}
                                <div className="bg-gradient-to-br from-brand/10 to-green-900/10 border border-brand/20 p-6 text-center">
                                    <div className="w-16 h-16 bg-brand/20 border border-brand/40 mx-auto flex items-center justify-center mb-3">
                                        <Shield className="w-8 h-8 text-brand" />
                                    </div>
                                    <h2 className="text-xl font-bold text-text-primary font-mono uppercase">Core Team Admin</h2>
                                    <p className="text-text-secondary text-xs font-mono mt-1">
                                        {address}
                                    </p>
                                    <Badge className="mt-3 bg-brand/20 text-brand border-brand/30">
                                        <Shield className="w-3 h-3 mr-1" />
                                        Full Access
                                    </Badge>
                                </div>

                                {/* Stats overview */}
                                {stats && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <StatCard label="Total Validations" value={stats.totalValidations} icon={<Activity className="w-4 h-4" />} />
                                        <StatCard label="Pending" value={stats.pending} icon={<Clock className="w-4 h-4" />} color="yellow" />
                                        <StatCard label="Escalated" value={stats.escalated} icon={<AlertTriangle className="w-4 h-4" />} color="red" />
                                        <StatCard label="Approved" value={stats.approved} icon={<CheckCircle className="w-4 h-4" />} color="green" />
                                        <StatCard label="Auto-Approved" value={stats.autoApproved} icon={<Clock className="w-4 h-4" />} color="blue" />
                                        <StatCard label="Success Rate" value={stats.totalValidations > 0 ? `${Math.round((stats.approved / (stats.totalValidations || 1)) * 100)}%` : 'N/A'} icon={<TrendingUp className="w-4 h-4" />} color="green" />
                                    </div>
                                )}

                                {/* Quick actions */}
                                <div className="space-y-2">
                                    <div className="text-xs text-text-secondary uppercase font-mono mb-2">Quick Actions</div>
                                    {[
                                        { label: 'User Disputes', desc: `${disputedOrders.length} active disputes`, icon: <ShieldAlert className="w-4 h-4" />, action: () => setTab('disputes'), color: 'text-orange-400' },
                                        { label: 'Activity Log', desc: `${recentActivity.length} recent validations`, icon: <Activity className="w-4 h-4" />, action: () => setTab('activity'), color: 'text-yellow-400' },
                                        { label: 'Manage Validators', desc: `${topValidators.length} active validators`, icon: <Users className="w-4 h-4" />, action: () => setTab('validators'), color: 'text-brand' },
                                    ].map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={item.action}
                                            className="w-full bg-surface border border-border p-4 flex items-center gap-3 hover:border-brand/30 transition-colors text-left"
                                        >
                                            <div className={`${item.color}`}>{item.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-text-primary">{item.label}</div>
                                                <div className="text-xs text-text-secondary">{item.desc}</div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-text-secondary" />
                                        </button>
                                    ))}
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-3 bg-red-500/10 border border-red-500/30 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Disconnect & Logout
                                </button>
                            </div>
                        )}

                        {/* ===== WALLET TAB ===== */}
                        {tab === 'wallet' && (
                            <div className="space-y-4">
                                {/* Wallet card */}
                                <div className="bg-gradient-to-br from-brand/10 to-green-900/10 border border-brand/20 p-6 text-center">
                                    <Wallet className="w-12 h-12 text-brand mx-auto mb-2" />
                                    <div className="text-xs text-text-secondary uppercase font-mono mb-1">Admin Wallet</div>
                                    <div className="text-2xl font-bold text-brand font-mono">
                                        {address?.slice(0, 10)}...{address?.slice(-6)}
                                    </div>
                                </div>

                                {/* Address copy */}
                                <div className="bg-surface border border-border p-4">
                                    <div className="text-xs text-text-secondary uppercase font-mono mb-2">Full Address</div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-background border border-border p-3 font-mono text-xs text-text-primary break-all">
                                            {address}
                                        </div>
                                        <button
                                            onClick={copyAddress}
                                            className="p-3 bg-brand/10 border border-brand/30 text-brand hover:bg-brand/20 transition-colors"
                                        >
                                            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Wallet info rows */}
                                <div className="bg-surface border border-border">
                                    <div className="flex justify-between items-center p-4 border-b border-border">
                                        <span className="text-text-secondary text-sm">Role</span>
                                        <span className="text-brand font-bold text-sm">Core Team Admin</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 border-b border-border">
                                        <span className="text-text-secondary text-sm">Network</span>
                                        <span className="text-text-primary font-mono text-sm">opBNB Testnet</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 border-b border-border">
                                        <span className="text-text-secondary text-sm">Validators</span>
                                        <span className="text-text-primary font-mono text-sm">{stats?.totalValidators || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4">
                                        <span className="text-text-secondary text-sm">Fee Collector</span>
                                        <span className="text-text-primary font-mono text-xs">
                                            {process.env.NEXT_PUBLIC_FEE_COLLECTOR?.slice(0, 10)}...
                                        </span>
                                    </div>
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-3 bg-red-500/10 border border-red-500/30 text-red-400 font-medium text-sm hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Disconnect & Logout
                                </button>
                            </div>
                        )}

                        {/* ===== ACTIVITY LOG TAB (read-only monitoring) ===== */}
                        {tab === 'activity' && (
                            <div className="space-y-3">
                                <div className="bg-surface border border-border p-3 mb-2">
                                    <div className="text-xs text-text-secondary">
                                        <Eye className="w-3 h-3 inline mr-1" />
                                        Read-only monitoring — validators handle all pending validations.
                                        Only escalated cases require admin action.
                                    </div>
                                </div>

                                {recentActivity.length === 0 ? (
                                    <div className="bg-surface border border-border p-8 text-center">
                                        <Activity className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                                        <h3 className="font-bold text-text-primary mb-2">No Activity Yet</h3>
                                        <p className="text-text-secondary text-sm">Validation activity will appear here.</p>
                                    </div>
                                ) : recentActivity.map(entry => (
                                    <div key={entry.id} className="bg-surface border border-border p-3 flex items-center gap-3">
                                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${entry.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                            entry.status === 'auto_approved' ? 'bg-blue-500/20 text-blue-400' :
                                                entry.status === 'escalated' ? 'bg-red-500/20 text-red-400' :
                                                    entry.status === 'flagged' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                            }`}>
                                            {entry.status === 'approved' ? <CheckCircle className="w-4 h-4" /> :
                                                entry.status === 'auto_approved' ? <Clock className="w-4 h-4" /> :
                                                    entry.status === 'escalated' ? <AlertTriangle className="w-4 h-4" /> :
                                                        entry.status === 'flagged' ? <XCircle className="w-4 h-4" /> :
                                                            <Clock className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-text-primary">${entry.amountUsdc.toFixed(2)}</span>
                                                <Badge className={`text-[10px] ${entry.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                                    entry.status === 'auto_approved' ? 'bg-blue-500/20 text-blue-400' :
                                                        entry.status === 'escalated' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                    {entry.status.replace('_', ' ')}
                                                </Badge>
                                            </div>
                                            <div className="text-[10px] text-text-secondary font-mono">
                                                {entry.id.slice(0, 16)} &bull; by {entry.resolvedBy} &bull; {entry.approvesCount}A/{entry.flagsCount}F
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-[10px] text-text-secondary">
                                                {entry.resolvedAt ? new Date(entry.resolvedAt).toLocaleTimeString() : 'pending'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ===== DISPUTES TAB ===== */}
                        {tab === 'disputes' && (
                            <div className="space-y-3">
                                {disputedOrders.length === 0 ? (
                                    <div className="bg-surface border border-border p-8 text-center">
                                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                        <h3 className="font-bold text-text-primary mb-2">No Active Disputes</h3>
                                        <p className="text-sm text-text-secondary">All orders are running smoothly</p>
                                    </div>
                                ) : disputedOrders.map((order: any) => (
                                    <div key={order.id} className="bg-surface border border-red-500/30 p-4">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className="w-4 h-4 text-orange-400" />
                                                <span className="text-sm font-bold text-text-primary">Dispute #{order.id.slice(0, 8)}</span>
                                            </div>
                                            <Badge className="text-[10px] bg-orange-500/20 text-orange-400">
                                                {order.status === 'mediation' ? 'mediation' : 'disputed'}
                                            </Badge>
                                        </div>

                                        {/* Order details */}
                                        <div className="bg-background border border-border p-3 mb-3">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <div className="text-text-secondary text-xs">Amount</div>
                                                    <div className="text-text-primary font-bold">${order.amountUsdc?.toFixed(2) || '0.00'} USDC</div>
                                                </div>
                                                <div>
                                                    <div className="text-text-secondary text-xs">Fiat</div>
                                                    <div className="text-text-primary font-bold">{order.fiatCurrency || 'INR'} {order.amountFiat?.toFixed(0) || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-text-secondary text-xs">Payment Method</div>
                                                    <div className="text-text-primary">{order.paymentMethod || 'UPI'}</div>
                                                </div>
                                                <div>
                                                    <div className="text-text-secondary text-xs">Type</div>
                                                    <div className="text-text-primary uppercase">{order.type || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Evidence / Proof Images */}
                                        <div className="space-y-2 mb-3">
                                            <div className="text-[10px] text-text-secondary uppercase font-mono">Evidence & Proof</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-background border border-border p-2">
                                                    <div className="text-[10px] text-text-secondary mb-1 flex items-center gap-1">
                                                        <ImageIcon className="w-3 h-3" /> Buyer QR / Screenshot
                                                    </div>
                                                    {order.qrImage ? (
                                                        <img src={order.qrImage} alt="Buyer QR" className="w-full h-32 object-contain bg-white rounded" />
                                                    ) : (
                                                        <div className="h-32 flex items-center justify-center text-xs text-text-secondary">No QR uploaded</div>
                                                    )}
                                                </div>
                                                <div className="bg-background border border-border p-2">
                                                    <div className="text-[10px] text-text-secondary mb-1 flex items-center gap-1">
                                                        <ImageIcon className="w-3 h-3" /> LP Payment Proof
                                                    </div>
                                                    {order.lpPaymentProof ? (
                                                        <img src={order.lpPaymentProof} alt="LP Proof" className="w-full h-32 object-contain bg-white rounded" />
                                                    ) : (
                                                        <div className="h-32 flex items-center justify-center text-xs text-text-secondary">No proof uploaded</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Addresses */}
                                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                            <div className="bg-background border border-border rounded p-2">
                                                <div className="text-text-secondary">Buyer</div>
                                                <div className="text-text-primary font-mono truncate">{order.userAddress || 'N/A'}</div>
                                            </div>
                                            <div className="bg-background border border-border rounded p-2">
                                                <div className="text-text-secondary">LP / Solver</div>
                                                <div className="text-text-primary font-mono truncate">{order.solverAddress || 'N/A'}</div>
                                            </div>
                                        </div>

                                        {/* Timeline */}
                                        <div className="bg-background border border-border p-2 mb-3 text-xs space-y-1">
                                            <div className="text-[10px] text-text-secondary uppercase font-mono mb-1">Timeline</div>
                                            <div className="flex justify-between">
                                                <span className="text-text-secondary">Created</span>
                                                <span className="text-text-primary">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</span>
                                            </div>
                                            {order.matchedAt && (
                                                <div className="flex justify-between">
                                                    <span className="text-text-secondary">Matched</span>
                                                    <span className="text-text-primary">{new Date(order.matchedAt).toLocaleString()}</span>
                                                </div>
                                            )}
                                            {order.paymentSentAt && (
                                                <div className="flex justify-between">
                                                    <span className="text-text-secondary">Payment Sent</span>
                                                    <span className="text-text-primary">{new Date(order.paymentSentAt).toLocaleString()}</span>
                                                </div>
                                            )}
                                            {order.disputePeriodEndsAt && (
                                                <div className="flex justify-between">
                                                    <span className="text-text-secondary">Dispute Window</span>
                                                    <span className="text-text-primary">Until {new Date(order.disputePeriodEndsAt).toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Dispute reason if available */}
                                        {order.disputeReason && (
                                            <div className="bg-red-500/10 border border-red-500/20 p-2 mb-3">
                                                <div className="text-[10px] text-red-400 uppercase font-mono mb-1">Dispute Reason</div>
                                                <div className="text-sm text-text-primary">{order.disputeReason}</div>
                                            </div>
                                        )}

                                        {/* Mediation info if scheduled */}
                                        {order.status === 'mediation' && order.meetLink && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 mb-3">
                                                <div className="text-[10px] text-yellow-400 uppercase font-mono mb-2">Mediation Scheduled</div>
                                                <a
                                                    href={order.meetLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-brand underline break-all"
                                                >
                                                    {order.meetLink}
                                                </a>
                                                <div className="text-xs text-text-secondary mt-2">
                                                    LP asked to email <span className="text-yellow-400 font-mono">info@abstractstudio.in</span>
                                                </div>
                                                {order.mediationScheduledAt && (
                                                    <div className="text-xs text-text-secondary mt-1">
                                                        Scheduled: {new Date(order.mediationScheduledAt).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                onClick={() => resolveDispute(order.id, 'approve')}
                                                disabled={resolving}
                                                className="py-2 bg-green-500/20 border border-green-500/50 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                            >
                                                <CheckCircle className="w-3 h-3" />
                                                Release
                                            </button>
                                            <button
                                                onClick={() => resolveDispute(order.id, 'refund')}
                                                disabled={resolving}
                                                className="py-2 bg-red-500/20 border border-red-500/50 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                            >
                                                <XCircle className="w-3 h-3" />
                                                Refund
                                            </button>
                                            <button
                                                onClick={() => resolveDispute(order.id, 'schedule_meet')}
                                                disabled={resolving}
                                                className="py-2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-sm font-medium hover:bg-yellow-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                            >
                                                <Calendar className="w-3 h-3" />
                                                Meet
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ===== VALIDATORS TAB ===== */}
                        {tab === 'validators' && (
                            <div className="space-y-2">
                                {topValidators.length === 0 ? (
                                    <div className="bg-surface border border-border p-8 text-center">
                                        <Users className="w-12 h-12 text-text-secondary mx-auto mb-4" />
                                        <h3 className="font-bold text-text-primary mb-2">No Validators Yet</h3>
                                    </div>
                                ) : topValidators.map((v, i) => (
                                    <div key={v.address} className="bg-surface border border-border p-3 flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' :
                                            i === 1 ? 'bg-gray-300 text-black' :
                                                i === 2 ? 'bg-orange-400 text-black' :
                                                    'bg-border text-text-secondary'
                                            }`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-mono text-text-primary text-sm truncate">{v.address}</div>
                                            <div className="text-xs text-text-secondary">
                                                {v.totalReviews} reviews &bull; {v.accuracy}% accuracy
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-green-400 font-bold text-sm">${v.totalEarned.toFixed(2)}</div>
                                            <div className="text-[10px] text-text-secondary">
                                                {v.approvals}A / {v.flags}F
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

function StatCard({ label, value, icon, color = 'brand' }: {
    label: string; value: string | number; icon: React.ReactNode; color?: string
}) {
    const colorMap: Record<string, string> = {
        brand: 'text-brand',
        yellow: 'text-yellow-400',
        red: 'text-red-400',
        green: 'text-green-400',
        blue: 'text-blue-400',
        orange: 'text-orange-400',
        purple: 'text-purple-400',
    }

    return (
        <div className="bg-surface border border-border p-3">
            <div className={`flex items-center gap-1 text-xs ${colorMap[color]} mb-1`}>
                {icon}
                <span className="uppercase text-text-secondary">{label}</span>
            </div>
            <div className={`text-xl font-bold font-mono ${colorMap[color]}`}>{value}</div>
        </div>
    )
}
