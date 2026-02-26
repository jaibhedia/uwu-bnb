/**
 * IPFS Integration for Dispute Evidence
 * 
 * Uses server-side API to upload to Pinata (keys not exposed to client).
 * Evidence is stored permanently and referenced by CID on-chain.
 */

// Public gateway for reading files (safe to expose)
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs'

export interface IpfsUploadResult {
    success: boolean
    cid?: string
    url?: string
    error?: string
}

export interface EvidenceMetadata {
    disputeId: string
    submittedBy: string
    type: 'screenshot' | 'chat_log' | 'transaction_proof' | 'other'
    description?: string
    fileName?: string
    timestamp: number
}

/**
 * Upload file to IPFS via server-side API
 * Pinata keys are kept server-side only
 */
export async function uploadToIpfs(
    file: File | Blob,
    metadata: EvidenceMetadata
): Promise<IpfsUploadResult> {
    try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('disputeId', metadata.disputeId)
        formData.append('submittedBy', metadata.submittedBy)
        formData.append('type', metadata.type)
        formData.append('description', metadata.description || '')

        // Use server-side API to upload (keys not exposed)
        const response = await fetch('/api/ipfs/upload', {
            method: 'POST',
            body: formData,
        })

        const result = await response.json()

        if (!result.success) {
            console.error('[IPFS] Upload failed:', result.error)
            return { success: false, error: result.error }
        }

        console.log(`[IPFS] Uploaded evidence for dispute ${metadata.disputeId}: ${result.cid}`)

        return {
            success: true,
            cid: result.cid,
            url: result.url,
        }
    } catch (error) {
        console.error('[IPFS] Upload error:', error)
        return { success: false, error: 'IPFS upload failed' }
    }
}

/**
 * Upload JSON metadata to IPFS via server-side API
 */
export async function uploadJsonToIpfs(
    data: Record<string, unknown>,
    name: string
): Promise<IpfsUploadResult> {
    try {
        // Convert JSON to Blob for upload
        const jsonBlob = new Blob([JSON.stringify(data)], { type: 'application/json' })
        
        const formData = new FormData()
        formData.append('file', jsonBlob, `${name}.json`)
        formData.append('disputeId', 'metadata')
        formData.append('submittedBy', 'system')
        formData.append('type', 'other')
        formData.append('description', name)

        const response = await fetch('/api/ipfs/upload', {
            method: 'POST',
            body: formData,
        })

        const result = await response.json()

        if (!result.success) {
            return { success: false, error: result.error }
        }

        const cid = result.cid

        return {
            success: true,
            cid,
            url: `${PINATA_GATEWAY}/${cid}`,
        }
    } catch (error) {
        console.error('[IPFS] JSON upload error:', error)
        return { success: false, error: 'IPFS upload failed' }
    }
}

/**
 * Fetch file from IPFS
 */
export async function fetchFromIpfs(cid: string): Promise<Response | null> {
    try {
        const response = await fetch(`${PINATA_GATEWAY}/${cid}`)
        if (!response.ok) return null
        return response
    } catch (error) {
        console.error('[IPFS] Fetch error:', error)
        return null
    }
}

/**
 * Get IPFS URL for a CID
 */
export function getIpfsUrl(cid: string): string {
    return `${PINATA_GATEWAY}/${cid}`
}

/**
 * Validate CID format
 */
export function isValidCid(cid: string): boolean {
    // CIDv0: Qm... (46 chars)
    // CIDv1: ba... (59 chars, base32)
    const cidV0Regex = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/
    const cidV1Regex = /^b[a-z2-7]{58}$/i
    
    return cidV0Regex.test(cid) || cidV1Regex.test(cid)
}

/**
 * Create evidence bundle for a dispute
 * Combines multiple evidence files into a single IPFS directory
 */
export async function createEvidenceBundle(
    disputeId: string,
    submittedBy: string,
    files: { file: File; type: EvidenceMetadata['type']; description: string }[]
): Promise<IpfsUploadResult> {
    const uploadedFiles: { cid: string; type: string; description: string; name: string }[] = []

    // Upload each file
    for (const { file, type, description } of files) {
        const result = await uploadToIpfs(file, {
            disputeId,
            submittedBy,
            type,
            description,
            fileName: file.name,
            timestamp: Date.now(),
        })

        if (result.success && result.cid) {
            uploadedFiles.push({
                cid: result.cid,
                type,
                description,
                name: file.name,
            })
        }
    }

    if (uploadedFiles.length === 0) {
        return { success: false, error: 'No files were uploaded' }
    }

    // Create manifest
    const manifest = {
        disputeId,
        submittedBy,
        submittedAt: new Date().toISOString(),
        files: uploadedFiles,
    }

    // Upload manifest
    const manifestResult = await uploadJsonToIpfs(
        manifest,
        `evidence_bundle_${disputeId}_${Date.now()}`
    )

    return manifestResult
}
