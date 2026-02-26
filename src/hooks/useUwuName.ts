"use client"

import { useState, useCallback } from 'react'

/**
 * Stub: .uwu name system not available on opBNB.
 * Kept for API compatibility; always returns no name and no-op actions.
 */
export function useUwuName(_address?: string) {
    const [uwuName] = useState<string | null>(null)
    const [isLoading] = useState(false)
    const [error] = useState<string | null>(null)

    const register = useCallback(async (_name: string): Promise<{ success: boolean; error?: string }> => {
        return { success: false, error: 'Name registration is not available' }
    }, [])

    const resolve = useCallback(async (_name: string): Promise<string | null> => {
        return null
    }, [])

    const checkAvailability = useCallback(async (_name: string): Promise<boolean> => {
        return false
    }, [])

    const validate = useCallback((name: string) => {
        const valid = /^[a-z0-9]{3,20}$/.test(name)
        return { valid, error: valid ? undefined : 'Name must be 3–20 lowercase letters or numbers' }
    }, [])

    return {
        uwuName,
        isLoading,
        error,
        register,
        resolve,
        checkAvailability,
        validate,
    }
}

/**
 * Resolve name to address (address-only on opBNB).
 */
export function useResolveName() {
    const [isLoading, setIsLoading] = useState(false)

    const resolveName = useCallback(async (nameOrAddress: string): Promise<{
        address: string | null
        type: 'address' | 'unknown'
    }> => {
        setIsLoading(true)
        try {
            if (nameOrAddress.startsWith('0x') && nameOrAddress.length === 42) {
                return { address: nameOrAddress, type: 'address' }
            }
            return { address: null, type: 'unknown' }
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        resolveName,
        isLoading,
    }
}
