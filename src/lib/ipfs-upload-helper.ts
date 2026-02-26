/**
 * Server-side helper: upload a base64-encoded image to IPFS via Pinata
 *
 * Reuses the same Pinata keys from /api/ipfs/upload.
 * Returns the IPFS gateway URL (or null if IPFS is not configured / upload fails).
 * On failure the caller should fall back to storing the original base64
 * so the flow is never blocked by an IPFS outage.
 */

const PINATA_API_KEY = process.env.PINATA_API_KEY || ''
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || ''
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs'

/**
 * Convert a base64 data-URI or raw base64 string to a File object.
 */
function base64ToFile(base64: string, filename: string): File {
    // Strip the data URI prefix if present (e.g. "data:image/png;base64,...")
    const parts = base64.split(',')
    const raw = parts.length > 1 ? parts[1] : parts[0]
    const mime = parts.length > 1
        ? (parts[0].match(/:(.*?);/)?.[1] || 'image/png')
        : 'image/png'

    const bytes = Buffer.from(raw, 'base64')
    return new File([bytes], filename, { type: mime })
}

export interface IPFSUploadResult {
    cid: string
    url: string
}

/**
 * Upload a base64 image to IPFS via Pinata.
 *
 * @param base64   Full base64 string (with or without data-URI prefix)
 * @param label    Human-readable label used in Pinata metadata (e.g. "order_xyz_qr")
 * @returns        `{ cid, url }` on success, `null` on failure or missing config
 */
export async function uploadBase64ToIPFS(
    base64: string,
    label: string,
): Promise<IPFSUploadResult | null> {
    // Guard: skip if Pinata is not configured
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
        console.warn('[IPFS] Pinata keys not configured — skipping upload')
        return null
    }

    // Guard: skip if the value is already an IPFS URL / CID
    if (base64.startsWith('http') || base64.startsWith('ipfs://') || base64.startsWith('Qm') || base64.startsWith('bafy')) {
        console.log('[IPFS] Value is already an IPFS URL, skipping re-upload')
        return null
    }

    // Guard: skip tiny strings that aren't real images (< 100 chars)
    if (base64.length < 100) {
        return null
    }

    try {
        const file = base64ToFile(base64, `${label}.png`)

        const formData = new FormData()
        formData.append('file', file)

        const metadata = JSON.stringify({
            name: label,
            keyvalues: {
                type: 'payment_proof',
                timestamp: Date.now().toString(),
            },
        })
        formData.append('pinataMetadata', metadata)
        formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                pinata_api_key: PINATA_API_KEY,
                pinata_secret_api_key: PINATA_SECRET_KEY,
            },
            body: formData,
        })

        if (!response.ok) {
            const err = await response.text()
            console.error('[IPFS] Pinata upload failed:', err)
            return null
        }

        const result = await response.json()
        const cid = result.IpfsHash as string
        const url = `${PINATA_GATEWAY}/${cid}`

        console.log(`[IPFS] Uploaded ${label}: ${cid}`)
        return { cid, url }
    } catch (error) {
        console.error('[IPFS] Upload error:', error)
        return null
    }
}
