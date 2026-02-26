import { SUPPORTED_CURRENCIES } from './web3-config'

/**
 * Currency conversion utility
 * Fetches real-time exchange rates and converts between fiat and USDC
 */

// Fallback rates if API fails
const FALLBACK_RATES: Record<string, number> = {
    INR: 83.50, // 1 USDC = 83.50 INR
    USD: 1.00,  // 1 USDC = 1 USD
    BRL: 5.62,  // 1 USDC = 5.62 BRL
    EUR: 0.94,  // 1 USDC = 0.94 EUR
}

// Cache for rates
let cachedRates: Record<string, number> = { ...FALLBACK_RATES }
let lastFetchTime = 0
const CACHE_DURATION = 60000 // 1 minute

/**
 * Fetch live USDC exchange rates from CoinGecko
 */
export async function fetchLiveRates(): Promise<Record<string, number>> {
    const now = Date.now()
    
    // Return cached if fresh
    if (now - lastFetchTime < CACHE_DURATION && Object.keys(cachedRates).length > 0) {
        return cachedRates
    }
    
    try {
        // CoinGecko free API - USDC price in various currencies
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr,usd,brl,eur',
            { 
                next: { revalidate: 60 },
                signal: AbortSignal.timeout(5000)
            }
        )
        
        if (!response.ok) throw new Error('Rate fetch failed')
        
        const data = await response.json()
        
        if (data['usd-coin']) {
            cachedRates = {
                INR: data['usd-coin'].inr || FALLBACK_RATES.INR,
                USD: data['usd-coin'].usd || FALLBACK_RATES.USD,
                BRL: data['usd-coin'].brl || FALLBACK_RATES.BRL,
                EUR: data['usd-coin'].eur || FALLBACK_RATES.EUR,
            }
            lastFetchTime = now
            console.log('[CurrencyConverter] Live rates fetched:', cachedRates)
        }
        
        return cachedRates
    } catch (error) {
        console.warn('[CurrencyConverter] Failed to fetch live rates, using fallback:', error)
        return FALLBACK_RATES
    }
}

/**
 * Get current cached rate (sync) - use fetchLiveRates() first for fresh data
 */
export function getExchangeRate(currencyCode: string): number {
    return cachedRates[currencyCode] || FALLBACK_RATES[currencyCode] || 1
}

/**
 * Convert fiat amount to USDC
 */
export function fiatToUsdc(amount: number, currencyCode: string): number {
    const rate = getExchangeRate(currencyCode)
    return amount / rate
}

/**
 * Convert USDC amount to fiat
 */
export function usdcToFiat(amount: number, currencyCode: string): number {
    const rate = getExchangeRate(currencyCode)
    return amount * rate
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number, currencyCode: string): string {
    const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode)
    const symbol = currency?.symbol || '$'

    return `${symbol}${amount.toFixed(2)}`
}

/**
 * Format USDC amount
 */
export function formatUsdc(amount: number): string {
    return `${amount.toFixed(2)} USDC`
}
