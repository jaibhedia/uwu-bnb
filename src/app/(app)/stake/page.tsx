"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronLeft, Shield, Coins, TrendingUp, AlertTriangle, Check, Loader2, ArrowUpRight, ArrowDownRight, Info } from "lucide-react"
import { useWallet } from "@/hooks/useWallet"
import { useStaking, TIER_CONFIG, type Tier } from "@/hooks/useStaking"
import { useTrustScore } from "@/hooks/useTrustScore"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

/**
 * Stake Management Page
 * 
 * Features:
 * - View current stake and tier
 * - Deposit/withdraw USDC stake
 * - View tier progression and benefits
 * - Understand slashing rules
 */
export default function StakePage() {
    const { isConnected, address, balanceFormatted } = useWallet()
    const {
        stakeProfile,
        isLoading: stakeLoading,
        depositStake,
        withdrawStake,
        fetchStakeProfile,
        getTierConfig
    } = useStaking()
    const { trustData, isLoading: trustLoading } = useTrustScore()

    const [mounted, setMounted] = useState(false)
    const [depositAmount, setDepositAmount] = useState("")
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [isDepositing, setIsDepositing] = useState(false)
    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [showDepositDialog, setShowDepositDialog] = useState(false)
    const [showWithdrawDialog, setShowWithdrawDialog] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (address) {
            fetchStakeProfile()
        }
    }, [address, fetchStakeProfile])

    const handleDeposit = async () => {
        const amount = parseFloat(depositAmount)
        if (isNaN(amount) || amount <= 0) return

        // Check if user has enough balance
        const walletBalance = parseFloat(balanceFormatted || '0')
        if (amount > walletBalance) {
            alert(`Insufficient USDC balance!\n\nYou have: ${walletBalance.toFixed(2)} USDC\nTrying to stake: ${amount.toFixed(2)} USDC\n\nPlease send USDC to your wallet address first.`)
            return
        }

        setIsDepositing(true)
        const success = await depositStake(amount)
        setIsDepositing(false)

        if (success) {
            setDepositAmount("")
            setShowDepositDialog(false)
        }
    }

    const handleWithdraw = async () => {
        const amount = parseFloat(withdrawAmount)
        if (isNaN(amount) || amount <= 0) return

        setIsWithdrawing(true)
        const success = await withdrawStake(amount)
        setIsWithdrawing(false)

        if (success) {
            setWithdrawAmount("")
            setShowWithdrawDialog(false)
        }
    }

    const getTierColor = (tier: Tier) => {
        const colors: Record<Tier, string> = {
            Starter: 'bg-gray-500',
            Bronze: 'bg-orange-500',
            Silver: 'bg-slate-400',
            Gold: 'bg-yellow-500',
            Diamond: 'bg-blue-500'
        }
        return colors[tier]
    }

    const getTierGradient = (tier: Tier) => {
        const gradients: Record<Tier, string> = {
            Starter: 'from-gray-500 to-gray-700',
            Bronze: 'from-orange-400 to-orange-600',
            Silver: 'from-slate-300 to-slate-500',
            Gold: 'from-yellow-400 to-yellow-600',
            Diamond: 'from-blue-400 to-blue-600'
        }
        return gradients[tier]
    }

    if (!mounted) return null

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background p-4 flex items-center justify-center">
                <div className="text-center font-mono">
                    <Shield className="w-16 h-16 text-brand mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-text-primary mb-2">STAKE_MANAGEMENT</h1>
                    <p className="text-text-secondary text-sm uppercase">Connect wallet to continue</p>
                </div>
            </div>
        )
    }

    const currentTier = stakeProfile?.tier || 'Starter'
    const currentConfig = getTierConfig(currentTier)

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border p-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="text-text-secondary hover:text-text-primary">
                            <ChevronLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-text-primary font-mono uppercase">
                                Stake_Management
                            </h1>
                            <p className="text-[10px] text-text-secondary uppercase">
                                Manage your USDC stake
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto p-4 space-y-6">
                {/* Current Tier Card */}
                <div className={`rounded-lg p-6 bg-gradient-to-br ${getTierGradient(currentTier)} text-white`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-sm opacity-80 uppercase">Current Tier</p>
                            <h2 className="text-3xl font-bold">{currentTier}</h2>
                        </div>
                        <Shield className="w-12 h-12 opacity-50" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div>
                            <p className="text-sm opacity-80">Staked</p>
                            <p className="text-2xl font-bold font-mono">
                                {stakeProfile?.baseStake.toFixed(2) || '0.00'} USDC
                            </p>
                        </div>
                        <div>
                            <p className="text-sm opacity-80">Max Order</p>
                            <p className="text-2xl font-bold font-mono">
                                ${currentConfig.maxOrder} USDC
                            </p>
                        </div>
                    </div>

                    {/* Progress to next tier */}
                    {stakeProfile?.nextTier && (
                        <div className="mt-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span>Progress to {stakeProfile.nextTier}</span>
                                <span>{stakeProfile.progressToNextTier.toFixed(0)}%</span>
                            </div>
                            <Progress 
                                value={stakeProfile.progressToNextTier} 
                                className="bg-white/20"
                                indicatorClassName="bg-white"
                            />
                            <p className="text-xs mt-2 opacity-80">
                                Stake {getTierConfig(stakeProfile.nextTier).stakeRequired - (stakeProfile?.baseStake || 0)} more USDC to unlock
                            </p>
                        </div>
                    )}
                </div>

                {/* Stake Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
                        <DialogTrigger asChild>
                            <button className="bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors text-left">
                                <ArrowUpRight className="w-8 h-8 text-success mb-2" />
                                <h3 className="font-bold text-text-primary">Deposit Stake</h3>
                                <p className="text-xs text-text-secondary">Add USDC to increase limits</p>
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Deposit Stake</DialogTitle>
                                <DialogDescription>
                                    Stake USDC to unlock higher trading limits and LP features.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <label className="text-sm text-text-secondary">Amount (USDC)</label>
                                    <Input
                                        type="number"
                                        placeholder="Enter amount"
                                        value={depositAmount}
                                        onChange={(e) => setDepositAmount(e.target.value)}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-text-secondary mt-1">
                                        Available: {balanceFormatted} USDC
                                    </p>
                                </div>
                                
                                {/* Quick amounts */}
                                <div className="flex gap-2">
                                    {[50, 200, 500, 2000].map(amount => (
                                        <button
                                            key={amount}
                                            onClick={() => setDepositAmount(amount.toString())}
                                            className="flex-1 py-2 text-sm border border-border rounded hover:border-brand transition-colors"
                                        >
                                            {amount}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <DialogFooter>
                                <button
                                    onClick={handleDeposit}
                                    disabled={isDepositing || !depositAmount}
                                    className="w-full py-3 bg-brand text-white rounded-lg font-bold disabled:opacity-50"
                                >
                                    {isDepositing ? (
                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                    ) : (
                                        'Deposit'
                                    )}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
                        <DialogTrigger asChild>
                            <button className="bg-surface border border-border rounded-lg p-4 hover:border-brand transition-colors text-left">
                                <ArrowDownRight className="w-8 h-8 text-warning mb-2" />
                                <h3 className="font-bold text-text-primary">Withdraw Stake</h3>
                                <p className="text-xs text-text-secondary">Remove unlocked USDC</p>
                            </button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Withdraw Stake</DialogTitle>
                                <DialogDescription>
                                    Withdraw unlocked stake. Note: Locked stake in active orders cannot be withdrawn.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <label className="text-sm text-text-secondary">Amount (USDC)</label>
                                    <Input
                                        type="number"
                                        placeholder="Enter amount"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        className="mt-1"
                                    />
                                    <p className="text-xs text-text-secondary mt-1">
                                        Available: {stakeProfile?.availableStake.toFixed(2) || '0.00'} USDC
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <button
                                    onClick={handleWithdraw}
                                    disabled={isWithdrawing || !withdrawAmount}
                                    className="w-full py-3 bg-warning text-black rounded-lg font-bold disabled:opacity-50"
                                >
                                    {isWithdrawing ? (
                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                    ) : (
                                        'Withdraw'
                                    )}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Stake Details */}
                <div className="bg-surface border border-border rounded-lg p-4">
                    <h3 className="font-bold text-text-primary mb-4 uppercase text-sm">Stake Details</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-text-secondary">Total Staked</span>
                            <span className="font-mono">{stakeProfile?.baseStake.toFixed(2) || '0.00'} USDC</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-secondary">Locked (in orders)</span>
                            <span className="font-mono text-warning">{stakeProfile?.lockedStake.toFixed(2) || '0.00'} USDC</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-secondary">Available</span>
                            <span className="font-mono text-success">{stakeProfile?.availableStake.toFixed(2) || '0.00'} USDC</span>
                        </div>
                        <div className="border-t border-border pt-3 flex justify-between">
                            <span className="text-text-secondary">Completed Trades</span>
                            <span className="font-mono">{stakeProfile?.completedTrades || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-secondary">LP Status</span>
                            <Badge variant={stakeProfile?.isLP ? 'success' : 'secondary'}>
                                {stakeProfile?.isLP ? 'Active LP' : 'Not LP'}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Tier Benefits */}
                <Tabs defaultValue="tiers" className="w-full">
                    <TabsList className="w-full">
                        <TabsTrigger value="tiers" className="flex-1">Tier Benefits</TabsTrigger>
                        <TabsTrigger value="slashing" className="flex-1">Slashing Rules</TabsTrigger>
                    </TabsList>

                    <TabsContent value="tiers" className="mt-4">
                        <div className="space-y-3">
                            {TIER_CONFIG.filter(tier => tier.name !== 'Starter').map((tier) => (
                                <div
                                    key={tier.name}
                                    className={`border rounded-lg p-4 ${
                                        tier.name === currentTier 
                                            ? 'border-brand bg-brand/10' 
                                            : 'border-border'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${getTierColor(tier.name)}`} />
                                            <span className="font-bold">{tier.name}</span>
                                            {tier.name === currentTier && (
                                                <Badge variant="default" className="text-xs">Current</Badge>
                                            )}
                                        </div>
                                        <span className="text-sm text-text-secondary font-mono">
                                            {tier.stakeRequired} USDC
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-secondary">Max Order</span>
                                        <span className="font-mono">
                                            ${tier.maxOrder} USDC
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {tier.features.map((feature) => (
                                            <Badge key={feature} variant="secondary" className="text-xs">
                                                {feature}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="slashing" className="mt-4">
                        <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
                            <div className="flex items-start gap-3 p-3 bg-error/10 border border-error/20 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-error">Stake can be slashed for bad behavior</p>
                                    <p className="text-xs text-text-secondary mt-1">
                                        Your staked USDC acts as collateral. It will be slashed if you commit fraud or violate platform rules.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-border">
                                    <span className="text-sm">Order Timeout (no payment)</span>
                                    <span className="text-error font-mono">-20%</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-border">
                                    <span className="text-sm">Fake Payment Proof</span>
                                    <span className="text-error font-mono">-100%</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-border">
                                    <span className="text-sm">Dispute Lost</span>
                                    <span className="text-error font-mono">-50%</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-border">
                                    <span className="text-sm">Payment Reversal</span>
                                    <span className="text-error font-mono">-200%</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm">Late Release (LP, &gt;30 min)</span>
                                    <span className="text-warning font-mono">-5%</span>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Become LP CTA */}
                {!stakeProfile?.isLP && (stakeProfile?.baseStake || 0) >= 500 && (
                    <Link href="/lp/register" className="block">
                        <div className="bg-brand/10 border border-brand rounded-lg p-4 hover:bg-brand/20 transition-colors">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-brand">Become a Liquidity Provider</h3>
                                    <p className="text-sm text-text-secondary">
                                        Earn 2% on every trade you fulfill
                                    </p>
                                </div>
                                <ChevronLeft className="w-5 h-5 text-brand rotate-180" />
                            </div>
                        </div>
                    </Link>
                )}
            </main>
        </div>
    )
}
