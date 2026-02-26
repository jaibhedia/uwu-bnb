"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
    ChevronLeft, Wallet, ArrowDownToLine, ArrowUpFromLine, Eye,
    Copy, CheckCircle, Loader2, QrCode, ExternalLink, History,
    RefreshCw, AlertTriangle, AtSign, User
} from "lucide-react"
import { useWallet } from "@/hooks/useWallet"
import { useResolveName } from "@/hooks/useUwuName"
import { WalletConnect } from "@/components/app/wallet-connect"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

/**
 * Wallet Management Page
 * 
 * Features:
 * - View wallet balance and details on BNB
 * - Deposit USDC from external wallet
 * - Withdraw USDC to external wallet
 * - Transaction history (from on-chain data)
 * 
 * Fully decentralized - no KYC, no centralized database
 */

function WalletPageContent() {
    const searchParams = useSearchParams()
    const initialAction = searchParams.get('action') || 'view'

    const { isConnected, address, balance, displayName, refreshBalance, isBalanceLoading } = useWallet()
    const [mounted, setMounted] = useState(false)
    const [activeTab, setActiveTab] = useState(initialAction)
    const [withdrawAmount, setWithdrawAmount] = useState("")
    const [withdrawAddress, setWithdrawAddress] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [copied, setCopied] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [txSuccess, setTxSuccess] = useState<string | null>(null)

    // Name resolution hooks
    const { resolveName, isLoading: uwuResolving } = useResolveName()
    const [resolvedAddress, setResolvedAddress] = useState<string | null>(null)
    const [isResolvingName, setIsResolvingName] = useState(false)
    const isAddress = (input: string) => /^0x[a-fA-F0-9]{40}$/.test(input)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (searchParams.get('action')) {
            setActiveTab(searchParams.get('action') || 'view')
        }
    }, [searchParams])

    // Resolve .uwu and .eth names to addresses
    useEffect(() => {
        const input = withdrawAddress.trim().toLowerCase()

        if (!input) {
            setResolvedAddress(null)
            return
        }

        // Direct address input
        if (isAddress(input)) {
            setResolvedAddress(input)
            return
        }

        // Resolve names
        const doResolveName = async () => {
            setIsResolvingName(true)
            setResolvedAddress(null)

            try {
                // Use unified resolver which handles both .uwu and .eth
                const result = await resolveName(input)
                if (result.address) {
                    setResolvedAddress(result.address)
                }
            } catch (err) {
                console.error('Name resolution failed:', err)
            } finally {
                setIsResolvingName(false)
            }
        }

        const timer = setTimeout(doResolveName, 500)
        return () => clearTimeout(timer)
    }, [withdrawAddress, resolveName])

    const handleCopyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await refreshBalance()
        setTimeout(() => setIsRefreshing(false), 1000)
    }

    const handleWithdraw = async () => {
        const amount = parseFloat(withdrawAmount)
        const targetAddress = resolvedAddress || withdrawAddress
        if (isNaN(amount) || amount <= 0 || !targetAddress) return

        if (amount > balance) {
            return // Insufficient balance
        }

        setIsProcessing(true)
        // TODO: Implement real withdraw using Thirdweb sendTransaction
        // For now, show message
        setTxSuccess(`Withdraw ${amount} USDC to ${targetAddress.slice(0, 8)}...`)
        setWithdrawAmount("")
        setWithdrawAddress("")
        setResolvedAddress(null)
        setIsProcessing(false)
        setTimeout(() => setTxSuccess(null), 5000)
    }

    if (!mounted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        )
    }

    if (!isConnected) {
        return (
            <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen bg-background">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="text-text-secondary hover:text-text-primary">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-xl font-bold text-text-primary">Wallet</h1>
                </div>

                <div className="bg-surface border border-border p-6 text-center">
                    <Wallet className="w-16 h-16 text-brand mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-text-primary mb-2">Connect Your Wallet</h2>
                    <p className="text-sm text-text-secondary mb-6">
                        Connect your wallet to view balance, deposit, or withdraw USDC
                    </p>
                    <WalletConnect />
                </div>
            </div>
        )
    }

    return (
        <div className="pb-24 pt-6 px-4 max-w-md mx-auto min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-border pb-4 border-dashed">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="text-text-secondary hover:text-brand">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold uppercase text-brand">WALLET_MANAGER</h1>
                        <p className="text-[10px] text-text-secondary uppercase">OPBNB_TESTNET</p>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    className="p-2 text-text-secondary hover:text-brand"
                    disabled={isRefreshing}
                >
                    <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Success Message */}
            {txSuccess && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-400 text-sm">{txSuccess}</span>
                </div>
            )}

            {/* Balance Card */}
            <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/20 border border-brand/20 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-xs text-gray-400 uppercase mb-1">BNB Wallet Balance</div>
                        <div className="text-3xl font-bold text-white flex items-center gap-2">
                            {isBalanceLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>{balance.toFixed(2)} USDC</>
                            )}
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
                        <Wallet className="w-6 h-6 text-brand" />
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                        <div className="text-xs text-gray-500 mb-1">{displayName}</div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 font-mono">
                                {address?.slice(0, 10)}...{address?.slice(-8)}
                            </span>
                            <button onClick={handleCopyAddress} className="text-gray-500 hover:text-white">
                                {copied ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-400">BNB Chain</Badge>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid grid-cols-4 bg-surface border border-border">
                    <TabsTrigger value="view" className="data-[state=active]:bg-brand data-[state=active]:text-white text-xs">
                        <Eye className="w-4 h-4" />
                    </TabsTrigger>
                    <TabsTrigger value="deposit" className="data-[state=active]:bg-brand data-[state=active]:text-white text-xs">
                        <ArrowDownToLine className="w-4 h-4" />
                    </TabsTrigger>
                    <TabsTrigger value="withdraw" className="data-[state=active]:bg-brand data-[state=active]:text-white text-xs">
                        <ArrowUpFromLine className="w-4 h-4" />
                    </TabsTrigger>
                    <TabsTrigger value="history" className="data-[state=active]:bg-brand data-[state=active]:text-white text-xs">
                        <History className="w-4 h-4" />
                    </TabsTrigger>
                </TabsList>

                {/* View Tab */}
                <TabsContent value="view" className="space-y-4">
                    <div className="bg-surface border border-border p-4">
                        <h3 className="font-bold text-text-primary mb-4 uppercase text-sm">Wallet Details</h3>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-border">
                                <span className="text-text-secondary text-sm">Network</span>
                                <span className="text-text-primary font-medium">BNB Chain</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border">
                                <span className="text-text-secondary text-sm">Token</span>
                                <span className="text-text-primary font-medium">USDC</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border">
                                <span className="text-text-secondary text-sm">Balance</span>
                                <span className="text-text-primary font-medium">{balance.toFixed(6)} USDC</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-text-secondary text-sm">Address</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-text-primary font-mono text-xs">{address?.slice(0, 8)}...</span>
                                    <button onClick={handleCopyAddress}>
                                        <Copy className="w-3 h-3 text-text-secondary hover:text-brand" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <Link
                            href="/scan"
                            className="bg-surface border border-border p-4 text-center hover:border-brand/50 transition-colors"
                        >
                            <QrCode className="w-6 h-6 text-brand mx-auto mb-2" />
                            <div className="text-sm font-medium text-text-primary">Scan & Pay</div>
                        </Link>
                        <a
                            href={`https://opbnb-testnet.bscscan.com/address/${address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-surface border border-border p-4 text-center hover:border-brand/50 transition-colors"
                        >
                            <ExternalLink className="w-6 h-6 text-brand mx-auto mb-2" />
                            <div className="text-sm font-medium text-text-primary">Explorer</div>
                        </a>
                    </div>
                </TabsContent>

                {/* Deposit Tab */}
                <TabsContent value="deposit" className="space-y-4">
                    <div className="bg-surface border border-border p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <ArrowDownToLine className="w-5 h-5 text-green-500" />
                            <h3 className="font-bold text-text-primary uppercase text-sm">Deposit USDC</h3>
                        </div>

                        <p className="text-text-secondary text-sm mb-6">
                            Transfer USDC from your external wallet to your uWu wallet on BNB chain.
                        </p>

                        {/* Deposit Address */}
                        <div className="bg-background/50 rounded-lg p-4">
                            <div className="text-xs text-text-secondary uppercase mb-2">Your BNB Wallet Address</div>
                            <div className="flex items-center gap-2">
                                <span className="text-text-primary font-mono text-sm break-all flex-1">
                                    {address}
                                </span>
                                <button
                                    onClick={handleCopyAddress}
                                    className="p-2 bg-brand/10 rounded-lg hover:bg-brand/20"
                                >
                                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-brand" />}
                                </button>
                            </div>
                        </div>

                        <p className="text-[10px] text-text-secondary mt-4 uppercase">
                            Send USDC to the above address on BNB chain. Balance updates automatically.
                        </p>
                    </div>
                </TabsContent>

                {/* Withdraw Tab */}
                <TabsContent value="withdraw" className="space-y-4">
                    <div className="bg-surface border border-border p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <ArrowUpFromLine className="w-5 h-5 text-blue-500" />
                            <h3 className="font-bold text-text-primary uppercase text-sm">Withdraw USDC</h3>
                        </div>

                        <p className="text-text-secondary text-sm mb-6">
                            Send USDC from your uWu wallet to any external wallet address.
                        </p>

                        {/* Available Balance */}
                        <div className="bg-background/50 rounded-lg p-3 mb-6 flex items-center justify-between">
                            <span className="text-text-secondary text-sm">Available</span>
                            <span className="text-text-primary font-bold">{balance.toFixed(2)} USDC</span>
                        </div>

                        <div className="space-y-4">
                            {/* Recipient Address */}
                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-2 block">
                                    Recipient Address or Name
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={withdrawAddress}
                                        onChange={(e) => setWithdrawAddress(e.target.value)}
                                        placeholder="0x..."
                                        className="w-full px-4 py-3 bg-background border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:border-brand font-mono text-sm pr-10"
                                    />
                                    {isResolvingName && (
                                        <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-text-secondary" />
                                    )}
                                    {!isResolvingName && resolvedAddress && (
                                        <CheckCircle className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-green-500" />
                                    )}
                                </div>


                            </div>

                            {/* Amount */}
                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-2 block">Amount</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        placeholder="0.00"
                                        max={balance}
                                        className="w-full px-4 py-3 bg-background border border-border text-text-primary placeholder-text-secondary focus:outline-none focus:border-brand text-lg"
                                    />
                                    <button
                                        onClick={() => setWithdrawAmount(balance.toString())}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-brand text-sm hover:underline"
                                    >
                                        MAX
                                    </button>
                                </div>
                            </div>

                            {/* Warning if exceeds balance */}
                            {parseFloat(withdrawAmount) > balance && (
                                <div className="flex items-center gap-2 text-red-400 text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    Insufficient balance
                                </div>
                            )}

                            <button
                                onClick={handleWithdraw}
                                disabled={isProcessing || !withdrawAmount || !resolvedAddress || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > balance || isResolvingName}
                                className="w-full py-4 bg-blue-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpFromLine className="w-5 h-5" />
                                        Withdraw USDC
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="space-y-4">
                    <div className="bg-surface border border-border p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="w-5 h-5 text-brand" />
                            <h3 className="font-bold text-text-primary uppercase text-sm">Transaction History</h3>
                        </div>

                        <div className="space-y-3">
                            {/* On-chain transaction history */}
                            <div className="text-center py-8 text-text-secondary">
                                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Transaction history is stored on-chain</p>
                                <a
                                    href={`https://opbnb-testnet.bscscan.com/address/${address}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand text-sm hover:underline inline-flex items-center gap-1 mt-2"
                                >
                                    View on Explorer
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default function WalletPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand" />
            </div>
        }>
            <WalletPageContent />
        </Suspense>
    )
}
