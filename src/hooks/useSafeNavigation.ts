"use client"

import { useRouter, usePathname } from "next/navigation"
import { useCallback } from "react"
import { useStaking } from "@/hooks/useStaking"
import { useWallet } from "@/hooks/useWallet"

/**
 * Safe Navigation Hook
 * 
 * Provides role-aware navigation that prevents users from
 * accidentally navigating to unauthorized pages.
 */
export function useSafeNavigation() {
    const router = useRouter()
    const pathname = usePathname()
    const { stakeProfile } = useStaking()
    const { isConnected } = useWallet()

    const isLP = stakeProfile?.isLP ?? false
    const isArbitrator = stakeProfile?.tier === 'Gold' || stakeProfile?.tier === 'Diamond'

    // Get the appropriate home route based on user role
    const getHomeRoute = useCallback(() => {
        if (!isConnected) return "/"
        return "/dashboard"
    }, [isConnected])

    // Get the appropriate back route based on current page and role
    const getBackRoute = useCallback(() => {
        // LP routes
        if (pathname.startsWith("/solver")) return "/dashboard"
        if (pathname.startsWith("/lp")) return "/dashboard"
        
        // DAO routes
        if (pathname.startsWith("/dao")) return "/dashboard"
        
        // Transaction routes - go back to dashboard
        if (pathname.startsWith("/buy")) return "/dashboard"
        if (pathname.startsWith("/sell")) return "/dashboard"
        if (pathname.startsWith("/scan")) return "/dashboard"
        if (pathname.startsWith("/trade")) return "/dashboard"
        
        // Stake routes
        if (pathname.startsWith("/stake")) return "/dashboard"
        
        // Orders
        if (pathname.startsWith("/orders")) return "/dashboard"
        
        // Default
        return "/dashboard"
    }, [pathname])

    // Navigate back safely (uses replace to prevent back-button issues)
    const goBack = useCallback(() => {
        const backRoute = getBackRoute()
        router.replace(backRoute)
    }, [router, getBackRoute])

    // Navigate to a route with role checking
    const navigateTo = useCallback((route: string) => {
        // Check LP routes
        if (route.startsWith("/solver") && !isLP) {
            console.warn("[SafeNav] Non-LP tried to access LP route")
            router.replace("/dashboard")
            return
        }
        
        // Check arbitrator routes
        if (route.startsWith("/dao") && !isArbitrator) {
            console.warn("[SafeNav] Non-validator tried to access DAO route")
            router.replace("/dashboard")
            return
        }

        router.push(route)
    }, [router, isLP, isArbitrator])

    // Replace current route (for redirects)
    const replaceTo = useCallback((route: string) => {
        router.replace(route)
    }, [router])

    // Go to dashboard
    const goHome = useCallback(() => {
        router.replace(getHomeRoute())
    }, [router, getHomeRoute])

    return {
        goBack,
        goHome,
        navigateTo,
        replaceTo,
        getBackRoute,
        getHomeRoute,
        isLP,
        isArbitrator,
        currentPath: pathname,
    }
}
