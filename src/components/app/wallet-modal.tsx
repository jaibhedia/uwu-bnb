"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X, Wallet, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
    />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-terminal-surface border border-terminal-border rounded-xl p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
                className
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-terminal-border transition-colors">
                <X className="h-4 w-4" />
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const wallets = [
    { id: "metamask", name: "MetaMask", icon: "🦊" },
    { id: "coinbase", name: "Coinbase Wallet", icon: "🔵" },
    { id: "walletconnect", name: "WalletConnect", icon: "🔗" },
    { id: "phantom", name: "Phantom", icon: "👻" },
]

interface WalletModalProps {
    children: React.ReactNode
    onConnect?: (walletId: string) => void
}

export function WalletModal({ children, onConnect }: WalletModalProps) {
    const [connecting, setConnecting] = React.useState<string | null>(null)

    const handleConnect = async (walletId: string) => {
        setConnecting(walletId)
        // Simulate connection
        await new Promise((resolve) => setTimeout(resolve, 1500))
        setConnecting(null)
        onConnect?.(walletId)
    }

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <div className="space-y-4">
                    <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">Connect Wallet</h2>
                        <p className="text-zinc-400 text-sm">
                            Connect your wallet to start trading on uWu
                        </p>
                    </div>

                    <div className="space-y-2">
                        {wallets.map((wallet) => (
                            <button
                                key={wallet.id}
                                onClick={() => handleConnect(wallet.id)}
                                disabled={connecting !== null}
                                className={cn(
                                    "w-full flex items-center gap-4 p-4 rounded-lg border border-terminal-border hover:border-neon-cyan/50 hover:bg-terminal-border/50 transition-all duration-200 group",
                                    connecting === wallet.id && "border-neon-cyan bg-terminal-border/50"
                                )}
                            >
                                <span className="text-2xl">{wallet.icon}</span>
                                <span className="text-white font-medium flex-1 text-left">{wallet.name}</span>
                                {connecting === wallet.id ? (
                                    <div className="w-5 h-5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-neon-cyan transition-colors" />
                                )}
                            </button>
                        ))}
                    </div>

                    <p className="text-xs text-zinc-500 text-center">
                        By connecting, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
