/**
 * QR Parser utility
 * Parses various QR code formats (UPI, PIX, generic payment)
 */

export interface ParsedQRData {
    type: 'upi' | 'pix' | 'generic'
    recipient?: string
    amount?: number
    currency?: string
    reference?: string
    rawData: string
}

/**
 * Parse UPI QR Code (India)
 * Format: upi://pay?pa=merchant@upi&pn=MerchantName&am=100&cu=INR
 */
function parseUPI(data: string): ParsedQRData | null {
    if (!data.startsWith('upi://')) return null

    try {
        const url = new URL(data)
        const params = new URLSearchParams(url.search)

        return {
            type: 'upi',
            recipient: params.get('pa') || undefined,
            amount: params.get('am') ? parseFloat(params.get('am')!) : undefined,
            currency: params.get('cu') || 'INR',
            reference: params.get('tn') || params.get('tr') || undefined,
            rawData: data,
        }
    } catch {
        return null
    }
}

/**
 * Parse PIX QR Code (Brazil)
 * PIX codes are EMV-based, more complex parsing needed
 * For MVP, we'll handle basic format
 */
function parsePIX(data: string): ParsedQRData | null {
    // PIX QR codes  typically start with specific EMV tags
    if (!data.includes('br.gov.bcb.pix')) return null

    return {
        type: 'pix',
        currency: 'BRL',
        rawData: data,
        // TODO: Implement full PIX EMV parsing
    }
}

/**
 * Parse generic payment QR
 * Tries to extract amount and recipient info
 */
function parseGeneric(data: string): ParsedQRData {
    return {
        type: 'generic',
        rawData: data,
    }
}

/**
 * Main QR parser function
 */
export function parseQRCode(data: string): ParsedQRData {
    // Try UPI first
    const upiData = parseUPI(data)
    if (upiData) return upiData

    // Try PIX
    const pixData = parsePIX(data)
    if (pixData) return pixData

    // Fallback to generic
    return parseGeneric(data)
}
