"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useWallet } from "@/hooks/useWallet"
import { useStaking } from "@/hooks/useStaking"
import { Loader2, Shield, AlertTriangle } from "lucide-react"

/**
 * Route Guard - Navigation protection
 * 
 * Key principle: NEVER redirect returning users to /onboarding.
 * Thirdweb auto-reconnect can take 5-10s in production.
 * Show loading screen while waiting, then allow access.
 */

// Public routes that don't require auth
const PUBLIC_ROUTES = ["/", "/onboarding", "/dao", "/lp/register"]

// LP-only routes (excluding register which anyone can access)
const LP_ROUTES = ["/solver", "/lp"]

// Session timeout (1 hour of inactivity)
const SESSION_TIMEOUT_MS = 60 * 60 * 1000

// Check if user has a previous session (they've onboarded before)
function hasPreviousSession(): boolean {
    if (typeof window === 'undefined') return false
    try {
        return Object.keys(localStorage).some(key => key.startsWith('uwu_onboarded_'))
    } catch {
        return false
    }
}

interface RouteGuardProps {
    children: React.ReactNode
}

export function RouteGuard({ children }: RouteGuardProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { isConnected, address, disconnect, isLoading: walletLoading } = useWallet()
    const { stakeProfile, fetchStakeProfile, isLoading: stakeLoading } = useStaking()

    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isChecking, setIsChecking] = useState(true)
    const [lastActivity, setLastActivity] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem('uwu_last_activity')
            if (stored) {
                const parsed = parseInt(stored, 10)
                if (Date.now() - parsed < 5 * 60 * 1000) {
                    return parsed
                }
            }
        }
        return Date.now()
    })
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)

    const isLP = stakeProfile?.isLP ?? false

    // Public routes are always authorized immediately
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

    // Safety timeout - if wallet hasn't connected after 6s, redirect to landing
    // Uses a ref so it only fires once per mount, not on every re-render
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)
    const reconnectExpiredRef = useRef(false)

    useEffect(() => {
        if (isPublicRoute || isConnected) {
            // Clear any pending timeout if user connects or navigates to public route
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
            return
        }

        // Only start timer once
        if (!reconnectTimerRef.current && !reconnectExpiredRef.current) {
            reconnectTimerRef.current = setTimeout(() => {
                reconnectTimerRef.current = null
                if (!isConnected) {
                    console.log("[RouteGuard] Reconnect timeout expired — redirecting to landing")
                    reconnectExpiredRef.current = true
                    setIsAuthorized(false)
                    setIsChecking(false)
                    router.replace("/")
                }
            }, 4000)
        }

        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current)
                reconnectTimerRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPublicRoute, isConnected])

    // Reset activity timer on user interaction
    const resetActivityTimer = useCallback(() => {
        const now = Date.now()
        setLastActivity(now)
        setShowTimeoutWarning(false)
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('uwu_last_activity', now.toString())
        }
    }, [])

    // Check session timeout
    useEffect(() => {
        if (!isConnected) return

        const checkTimeout = setInterval(() => {
            const elapsed = Date.now() - lastActivity

            if (elapsed > SESSION_TIMEOUT_MS - 120000 && elapsed < SESSION_TIMEOUT_MS) {
                setShowTimeoutWarning(true)
            }

            if (elapsed > SESSION_TIMEOUT_MS) {
                console.log("[RouteGuard] Session timeout - logging out")
                disconnect?.()
                router.replace("/")
            }
        }, 10000)

        return () => clearInterval(checkTimeout)
    }, [isConnected, lastActivity, disconnect, router])

    // Track user activity
    useEffect(() => {
        const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
        events.forEach(event => {
            window.addEventListener(event, resetActivityTimer, { passive: true })
        })
        return () => {
            events.forEach(event => {
                window.removeEventListener(event, resetActivityTimer)
            })
        }
    }, [resetActivityTimer])

    // Fetch stake profile when connected
    useEffect(() => {
        if (address && isConnected) {
            fetchStakeProfile()
        }
    }, [address, isConnected, fetchStakeProfile])

    // Main route authorization check
    useEffect(() => {
        // Public routes - always allow, no delay
        if (isPublicRoute) {
            setIsAuthorized(true)
            setIsChecking(false)
            return
        }

        // If reconnect timeout already expired, don't keep checking
        if (reconnectExpiredRef.current && !isConnected) {
            setIsAuthorized(false)
            setIsChecking(false)
            return
        }

        // Connected - do role checks
        if (isConnected) {
            // Reset the expired flag since we're now connected
            reconnectExpiredRef.current = false

            const isLPRoute = LP_ROUTES.some(route =>
                pathname === route || (pathname.startsWith(route + "/") && !pathname.startsWith("/lp/register"))
            )

            if (isLPRoute) {
                if (stakeLoading) {
                    setIsChecking(true)
                    return
                }
                if (!isLP) {
                    console.log("[RouteGuard] Non-LP trying to access LP route")
                    router.replace("/lp/register")
                    setIsAuthorized(false)
                    setIsChecking(false)
                    return
                }
            }

            // All checks passed - authorized
            setIsAuthorized(true)
            setIsChecking(false)
            return
        }

        // Still loading wallet state - keep waiting (don't redirect yet)
        if (walletLoading) {
            console.log("[RouteGuard] Wallet still loading, waiting...")
            setIsChecking(true)
            return
        }

        // Not connected, wallet done loading — give Thirdweb a few seconds to auto-reconnect
        // The safety timeout above will handle the fallback redirect
        if (hasPreviousSession()) {
            console.log("[RouteGuard] Previous session detected, waiting for reconnection...")
            setIsChecking(true)
            return
        }

        // Brand new user on protected route — redirect immediately
        console.log("[RouteGuard] No wallet - redirecting to landing")
        router.replace("/")
        setIsAuthorized(false)
        setIsChecking(false)
    }, [pathname, isConnected, walletLoading, stakeLoading, isLP, isPublicRoute, router])

    // Prevent browser back button from going to unauthorized routes
    useEffect(() => {
        const handlePopState = () => {
            if (!isPublicRoute) {
                setIsChecking(true)
            }
        }
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [isPublicRoute])

    // Public routes render immediately - no loading gate
    if (isPublicRoute) {
        return <>{children}</>
    }

    // Loading state for protected routes
    if (isChecking || walletLoading) {
        return (
            <div className="min-h-screen bg-background" />
        )
    }

    // Session timeout warning
    if (showTimeoutWarning) {
        return (
            <>
                {children}
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-warning rounded-lg p-6 max-w-sm text-center">
                        <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-text-primary mb-2">Session Expiring</h2>
                        <p className="text-sm text-text-secondary mb-4">
                            Your session will expire in 2 minutes due to inactivity.
                        </p>
                        <button
                            onClick={resetActivityTimer}
                            className="w-full py-3 bg-brand text-white rounded-lg font-bold"
                        >
                            Continue Session
                        </button>
                    </div>
                </div>
            </>
        )
    }

    // Not authorized
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-background" />
        )
    }

    return <>{children}</>
}
