"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
    ChevronLeft, Shield, Clock, CheckCircle, XCircle, AlertTriangle,
    Award, Eye, ThumbsUp, ThumbsDown, Loader2, Coins, DollarSign,
    ImageIcon, RefreshCw, Flag, ArrowRight, Zap
} from "lucide-react"
import { useWallet } from "@/hooks/useWallet"
import { useStaking } from "@/hooks/useStaking"
import { Badge } from "@/components/ui/badge"
import { WalletConnect } from "@/components/app/wallet-connect"

/**
 * Validator Dashboard — DAO Validation Page
 * 
 * Open pool: ALL Gold+ stakers see ALL pending validations.
 * Race to review — first 3 votes resolve the task.
 * Majority approve → LP gets paid. Majority flag → escalated to admin.
 * Validators earn $0.05 USDC per review.
 */

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
    myVote?: string | null
    votesCount: number
    approvesCount: number
    flagsCount: number
}

interface ValidatorProfile {
    address: string
    totalReviews: number
    totalEarned: number
    approvals: number
    flags: number
    accuracy: number
    lastReviewAt?: number
}

interface ValidationConfig {
    threshold: number
    rewardPerReview: number
    timeoutMs: number
}

export default function ValidatorDashboard() {
    const { isConnected, address } = useWallet()
    const { stakeProfile } = useStaking()

    const [mounted, setMounted] = useState(false)
    const [validations, setValidations] = useState<ValidationTask[]>([])
    const [profile, setProfile] = useState<ValidatorProfile | null>(null)
    const [config, setConfig] = useState<ValidationConfig>({ threshold: 3, rewardPerReview: 0.05, timeoutMs: 3600000 })
    const [isLoading, setIsLoading] = useState(true)
    const [selectedTask, setSelectedTask] = useState<ValidationTask | null>(null)
    const [fullEvidence, setFullEvidence] = useState<ValidationTask | null>(null)
    const [isVoting, setIsVoting] = useState(false)
    const [notes, setNotes] = useState("")
    const [showResolved, setShowResolved] = useState(false)
    const [tab, setTab] = useState<'profile' | 'history' | 'wallet'>('history')

    // DAO validators from env — bypass Gold+ requirement
    const TEST_VALIDATORS = (process.env.NEXT_PUBLIC_DAO_VALIDATORS || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
    const isTestValidator = address ? TEST_VALIDATORS.includes(address.toLowerCase()) : false

    // Check if user qualifies as validator (Gold+ tier OR whitelisted validator)
    const isGoldPlus = isTestValidator || (stakeProfile && (stakeProfile.tier === 'Gold' || stakeProfile.tier === 'Diamond'))

    useEffect(() => {
        setMounted(true)
    }, [])

    // Fetch validations
    const fetchValidations = useCallback(async () => {
        if (!address) return
        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                address,
                resolved: 'true',
                ...(showResolved && { resolved: 'true' })
            })
            const res = await fetch(`/api/validations?${params}`)
            const data = await res.json()
            if (data.success) {
                setValidations(data.validations || [])
                setProfile(data.profile || null)
                setConfig(data.config)
            }
        } catch (err) {
            console.error('Failed to fetch validations:', err)
        } finally {
            setIsLoading(false)
        }
    }, [address, showResolved])

    useEffect(() => {
        if (address && isGoldPlus) {
            setShowResolved(true)
            fetchValidations()
            const interval = setInterval(fetchValidations, 10000)
            return () => clearInterval(interval)
        }
    }, [address, isGoldPlus, fetchValidations])

    // Fetch full evidence for selected task
    const loadFullEvidence = async (taskId: string) => {
        try {
            const res = await fetch('/api/validations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_detail', taskId })
            })
            const data = await res.json()
            if (data.success) {
                setFullEvidence(data.validation)
            }
        } catch (err) {
            console.error('Failed to load evidence:', err)
        }
    }

    // Inline vote (from card buttons — no notes)
    const submitVoteInline = async (task: ValidationTask, decision: 'approve' | 'flag') => {
        if (!address) return
        setIsVoting(true)
        try {
            const res = await fetch('/api/validations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: task.id,
                    validator: address,
                    decision,
                })
            })
            const data = await res.json()
            if (data.success) {
                setSelectedTask(null)
                fetchValidations()
            } else {
                alert(data.error || 'Vote failed')
            }
        } catch (err) {
            console.error('Vote failed:', err)
            alert('Network error')
        } finally {
            setIsVoting(false)
        }
    }

    // Submit vote (from modal — with optional notes)
    const submitVote = async (decision: 'approve' | 'flag') => {
        if (!selectedTask || !address) return
        setIsVoting(true)
        try {
            const res = await fetch('/api/validations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: selectedTask.id,
                    validator: address,
                    decision,
                    notes: notes.trim() || undefined,
                })
            })
            const data = await res.json()
            if (data.success) {
                setSelectedTask(null)
                setFullEvidence(null)
                setNotes("")
                fetchValidations()
            } else {
                alert(data.error || 'Vote failed')
            }
        } catch (err) {
            console.error('Vote failed:', err)
            alert('Network error')
        } finally {
            setIsVoting(false)
        }
    }

    // Open review modal
    const openReview = (task: ValidationTask) => {
        setSelectedTask(task)
        setNotes("")
        loadFullEvidence(task.id)
    }

    if (!mounted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        )
    }

    // Time remaining formatter
    const timeLeft = (deadline: number) => {
        const ms = deadline - Date.now()
        if (ms <= 0) return 'Expired'
        const mins = Math.floor(ms / 60000)
        if (mins < 60) return `${mins}m left`
        return `${Math.floor(mins / 60)}h ${mins % 60}m left`
    }

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header */}
            <header className="border-b border-border p-4 sticky top-0 bg-background/80 backdrop-blur-md z-10">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="text-text-secondary hover:text-white">
                            <ChevronLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-white font-mono uppercase flex items-center gap-2">
                                <Shield className="w-5 h-5 text-brand" />
                                Validate
                            </h1>
                            <p className="text-[10px] text-text-secondary uppercase tracking-wider">
                                Review payments &bull; Earn $0.05/review
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {profile && (
                            <Badge className="bg-green-500/20 text-green-400 font-mono">
                                <DollarSign className="w-3 h-3 mr-0.5" />
                                {profile.totalEarned.toFixed(2)}
                            </Badge>
                        )}
                        <button
                            onClick={fetchValidations}
                            className="p-2 text-text-secondary hover:text-white transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Not Connected */}
                {!isConnected && (
                    <div className="bg-surface border border-border p-8 text-center">
                        <Shield className="w-16 h-16 text-brand mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-text-primary mb-2">Connect Wallet</h2>
                        <p className="text-text-secondary mb-6">Connect to access the validation dashboard.</p>
                        <WalletConnect />
                    </div>
                )}

                {/* Not Gold+ */}
                {isConnected && !isGoldPlus && (
                    <div className="bg-surface border border-border p-8 text-center">
                        <Award className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-text-primary mb-2">Gold+ Required</h2>
                        <p className="text-text-secondary mb-2">
                            Validators must stake &ge;$500 USDC (Gold tier) to participate.
                        </p>
                        <p className="text-text-secondary text-sm mb-6">
                            Your current tier: <span className="text-brand font-bold">{stakeProfile?.tier || 'None'}</span>
                            {stakeProfile?.baseStake ? ` ($${stakeProfile.baseStake.toFixed(0)} staked)` : ''}
                        </p>
                        <Link
                            href="/stake"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white font-medium hover:bg-brand/90 transition-colors"
                        >
                            <Coins className="w-5 h-5" />
                            Stake to Gold
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                )}

                {/* Validator Dashboard */}
                {isConnected && isGoldPlus && (
                    <>
                        {/* Tabs */}
                        <div className="flex gap-2 mb-6">
                            <button
                                onClick={() => setTab('profile')}
                                className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                                    tab === 'profile'
                                        ? 'bg-brand text-white border-brand'
                                        : 'bg-surface text-text-secondary border-border hover:text-text-primary'
                                }`}
                            >
                                <Shield className="w-4 h-4 inline mr-1" />
                                DAO Profile
                            </button>
                            <button
                                onClick={() => { setTab('history'); setShowResolved(true); fetchValidations() }}
                                className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                                    tab === 'history'
                                        ? 'bg-brand text-white border-brand'
                                        : 'bg-surface text-text-secondary border-border hover:text-text-primary'
                                }`}
                            >
                                <Clock className="w-4 h-4 inline mr-1" />
                                History
                            </button>
                            <button
                                onClick={() => setTab('wallet')}
                                className={`flex-1 py-2 text-sm font-medium border transition-colors ${
                                    tab === 'wallet'
                                        ? 'bg-brand text-white border-brand'
                                        : 'bg-surface text-text-secondary border-border hover:text-text-primary'
                                }`}
                            >
                                <Coins className="w-4 h-4 inline mr-1" />
                                Wallet
                            </button>
                        </div>

                        {/* Profile Tab */}
                        {tab === 'profile' && (
                            <div className="space-y-4">
                                {/* Stats */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-surface border border-border p-3 text-center">
                                        <div className="text-2xl font-bold text-green-400 font-mono">
                                            {profile?.totalReviews || 0}
                                        </div>
                                        <div className="text-[10px] text-text-secondary uppercase">Reviews</div>
                                    </div>
                                    <div className="bg-surface border border-border p-3 text-center">
                                        <div className="text-2xl font-bold text-yellow-400 font-mono">
                                            {profile?.accuracy || 100}%
                                        </div>
                                        <div className="text-[10px] text-text-secondary uppercase">Accuracy</div>
                                    </div>
                                    <div className="bg-surface border border-border p-3 text-center">
                                        <div className="text-2xl font-bold text-brand font-mono">
                                            ${(profile?.totalEarned || 0).toFixed(2)}
                                        </div>
                                        <div className="text-[10px] text-text-secondary uppercase">Earned</div>
                                    </div>
                                </div>

                                {/* Breakdown */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-surface border border-border p-4">
                                        <div className="text-sm text-text-secondary mb-1">Approvals</div>
                                        <div className="text-xl font-bold text-green-400 font-mono">
                                            {profile?.approvals || 0}
                                        </div>
                                    </div>
                                    <div className="bg-surface border border-border p-4">
                                        <div className="text-sm text-text-secondary mb-1">Flags</div>
                                        <div className="text-xl font-bold text-red-400 font-mono">
                                            {profile?.flags || 0}
                                        </div>
                                    </div>
                                </div>

                                {/* How it works */}
                                <div className="bg-surface border border-border p-4">
                                    <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-brand" />
                                        How Validation Works
                                    </h3>
                                    <div className="space-y-3 text-sm text-text-secondary">
                                        <div className="flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xs font-bold shrink-0">1</div>
                                            <div>LP submits fiat payment proof &rarr; order enters <span className="text-brand">verifying</span> state</div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xs font-bold shrink-0">2</div>
                                            <div>Up to <span className="text-brand">{config.threshold} validators</span> can vote &mdash; majority of <span className="text-brand">{Math.ceil(config.threshold / 2)}</span> resolves the task</div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xs font-bold shrink-0">3</div>
                                            <div>Majority approve &rarr; LP gets paid. Majority flag &rarr; escalated to admin.</div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold shrink-0">$</div>
                                            <div>You earn <span className="text-green-400">${config.rewardPerReview} USDC</span> per review</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* History Tab */}
                        {tab === 'history' && (
                            <div className="space-y-3">
                                {isLoading ? (
                                    <div className="bg-surface border border-border p-8 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-2" />
                                        <p className="text-text-secondary text-sm">Loading history...</p>
                                    </div>
                                ) : validations.length === 0 ? (
                                    <div className="bg-surface border border-border p-8 text-center">
                                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-text-primary mb-2">No History Yet</h3>
                                        <p className="text-text-secondary text-sm">
                                            Your reviewed validations will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    validations.map((task) => (
                                        <div
                                            key={task.id}
                                            className="bg-surface border border-border p-4"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <span className="text-xs text-brand font-mono">
                                                        #{task.orderId.slice(0, 8)}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-lg font-bold text-text-primary">
                                                            ${task.evidence.amountUsdc.toFixed(2)}
                                                        </span>
                                                        <span className="text-xs text-text-secondary">
                                                            &asymp; {task.evidence.fiatCurrency} {task.evidence.amountFiat.toFixed(0)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <StatusBadge status={task.status} myVote={task.myVote} />
                                            </div>

                                            {/* Approve / Flag buttons for pending tasks the user hasn't voted on */}
                                            {task.status === 'pending' && !task.myVote && (
                                                <div className="mt-3 pt-3 border-t border-border space-y-2">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedTask(task); submitVoteInline(task, 'approve') }}
                                                            disabled={isVoting}
                                                            className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                                        >
                                                            {isVoting && selectedTask?.id === task.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <ThumbsUp className="w-4 h-4" />
                                                            )}
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedTask(task); submitVoteInline(task, 'flag') }}
                                                            disabled={isVoting}
                                                            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                                        >
                                                            {isVoting && selectedTask?.id === task.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <ThumbsDown className="w-4 h-4" />
                                                            )}
                                                            Flag
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openReview(task) }}
                                                        className="w-full py-2 text-xs text-text-secondary hover:text-brand border border-border hover:border-brand rounded-lg flex items-center justify-center gap-1 transition-colors"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View Evidence &amp; Add Notes
                                                    </button>
                                                </div>
                                            )}

                                            {task.myVote && (
                                                <div className="mt-2 pt-2 border-t border-border text-xs text-text-secondary flex items-center gap-1">
                                                    {task.myVote === 'approve' ? (
                                                        <><ThumbsUp className="w-3 h-3 text-green-400" /> You approved</>
                                                    ) : (
                                                        <><ThumbsDown className="w-3 h-3 text-red-400" /> You flagged</>
                                                    )}
                                                    <span className="ml-auto text-green-400">+${config.rewardPerReview}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* Wallet Tab */}
                        {tab === 'wallet' && (
                            <div className="space-y-4">
                                <div className="bg-gradient-to-br from-green-900/20 to-brand/10 border border-green-500/20 p-6 text-center">
                                    <DollarSign className="w-12 h-12 text-green-400 mx-auto mb-2" />
                                    <div className="text-3xl font-bold text-green-400 font-mono mb-1">
                                        ${(profile?.totalEarned || 0).toFixed(2)}
                                    </div>
                                    <div className="text-xs text-text-secondary uppercase">Total Validator Earnings</div>
                                </div>

                                <div className="bg-surface border border-border p-4">
                                    <div className="flex justify-between items-center py-2 border-b border-border">
                                        <span className="text-text-secondary text-sm">Address</span>
                                        <span className="text-text-primary font-mono text-xs">{address?.slice(0, 10)}...{address?.slice(-6)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-border">
                                        <span className="text-text-secondary text-sm">Tier</span>
                                        <span className="text-brand font-bold">{stakeProfile?.tier || 'Gold'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-text-secondary text-sm">Reward Rate</span>
                                        <span className="text-green-400 font-bold">${config.rewardPerReview}/review</span>
                                    </div>
                                </div>

                                <Link
                                    href="/wallet"
                                    className="block w-full py-3 bg-brand text-white text-center font-bold text-sm hover:bg-brand/90 transition-colors"
                                >
                                    Go to Wallet
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Review Modal Overlay */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => { setSelectedTask(null); setFullEvidence(null); setNotes('') }}>
                    <div className="bg-surface border border-border w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                <Eye className="w-5 h-5 text-brand" />
                                Review Evidence
                            </h3>
                            <button
                                onClick={() => { setSelectedTask(null); setFullEvidence(null); setNotes('') }}
                                className="text-text-secondary hover:text-white p-1"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Order Details */}
                        <div className="bg-background border border-border rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-brand font-mono">#{selectedTask.orderId.slice(0, 8)}</span>
                                <StatusBadge status={selectedTask.status} myVote={selectedTask.myVote} />
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-text-secondary text-xs">Amount</div>
                                    <div className="text-text-primary font-bold">${selectedTask.evidence.amountUsdc.toFixed(2)} USDC</div>
                                </div>
                                <div>
                                    <div className="text-text-secondary text-xs">Fiat</div>
                                    <div className="text-text-primary font-bold">{selectedTask.evidence.fiatCurrency} {selectedTask.evidence.amountFiat.toFixed(0)}</div>
                                </div>
                                <div>
                                    <div className="text-text-secondary text-xs">Payment Method</div>
                                    <div className="text-text-primary">{selectedTask.evidence.paymentMethod || 'UPI'}</div>
                                </div>
                                <div>
                                    <div className="text-text-secondary text-xs">Votes</div>
                                    <div className="text-text-primary">{selectedTask.votesCount}/{selectedTask.threshold}</div>
                                </div>
                            </div>
                        </div>

                        {/* Evidence Images */}
                        {(fullEvidence || selectedTask) && (
                            <div className="space-y-3 mb-4">
                                {(fullEvidence?.evidence.userQrImage || selectedTask.evidence.userQrImage) && (
                                    <div>
                                        <div className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                                            <ImageIcon className="w-3 h-3" /> Buyer QR / Screenshot
                                        </div>
                                        <img
                                            src={fullEvidence?.evidence.userQrImage || selectedTask.evidence.userQrImage}
                                            alt="Buyer evidence"
                                            className="w-full rounded-lg border border-border max-h-48 object-contain bg-black"
                                        />
                                    </div>
                                )}
                                {(fullEvidence?.evidence.lpScreenshot || selectedTask.evidence.lpScreenshot) && (
                                    <div>
                                        <div className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                                            <ImageIcon className="w-3 h-3" /> LP Payment Proof
                                        </div>
                                        <img
                                            src={fullEvidence?.evidence.lpScreenshot || selectedTask.evidence.lpScreenshot}
                                            alt="LP payment proof"
                                            className="w-full rounded-lg border border-border max-h-48 object-contain bg-black"
                                        />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-background border border-border rounded p-2">
                                        <div className="text-text-secondary">Buyer</div>
                                        <div className="text-text-primary font-mono truncate">{selectedTask.evidence.userAddress.slice(0,8)}...{selectedTask.evidence.userAddress.slice(-4)}</div>
                                    </div>
                                    <div className="bg-background border border-border rounded p-2">
                                        <div className="text-text-secondary">LP</div>
                                        <div className="text-text-primary font-mono truncate">{selectedTask.evidence.lpAddress.slice(0,8)}...{selectedTask.evidence.lpAddress.slice(-4)}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Notes Input */}
                        {selectedTask.status === 'pending' && !selectedTask.myVote && (
                            <div className="mb-4">
                                <label className="text-xs text-text-secondary block mb-1">Notes (optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add any notes about this payment..."
                                    className="w-full bg-background border border-border rounded-lg p-3 text-sm text-text-primary placeholder:text-text-secondary/50 resize-none h-20 focus:outline-none focus:border-brand"
                                />
                            </div>
                        )}

                        {/* Action Buttons */}
                        {selectedTask.status === 'pending' && !selectedTask.myVote && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => submitVote('approve')}
                                    disabled={isVoting}
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {isVoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-5 h-5" />}
                                    Approve
                                </button>
                                <button
                                    onClick={() => submitVote('flag')}
                                    disabled={isVoting}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {isVoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-5 h-5" />}
                                    Flag
                                </button>
                            </div>
                        )}

                        {/* Already voted */}
                        {selectedTask.myVote && (
                            <div className="text-center py-3 text-sm text-text-secondary">
                                {selectedTask.myVote === 'approve' ? (
                                    <span className="text-green-400 flex items-center justify-center gap-1"><ThumbsUp className="w-4 h-4" /> You approved this payment</span>
                                ) : (
                                    <span className="text-red-400 flex items-center justify-center gap-1"><ThumbsDown className="w-4 h-4" /> You flagged this payment</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// Status badge component
function StatusBadge({ status, myVote }: { status: string; myVote?: string | null }) {
    if (myVote) {
        return (
            <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">
                <CheckCircle className="w-3 h-3 mr-1" />
                Voted
            </Badge>
        )
    }

    switch (status) {
        case 'pending':
            return (
                <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                </Badge>
            )
        case 'approved':
        case 'auto_approved':
            return (
                <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Approved
                </Badge>
            )
        case 'escalated':
            return (
                <Badge className="bg-red-500/20 text-red-400 text-[10px]">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Escalated
                </Badge>
            )
        default:
            return (
                <Badge className="bg-gray-500/20 text-gray-400 text-[10px]">
                    {status}
                </Badge>
            )
    }
}
