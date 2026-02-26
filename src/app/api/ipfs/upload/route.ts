import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side IPFS Upload API
 * 
 * Pinata API keys are kept server-side only for security.
 * This endpoint handles file uploads to IPFS via Pinata.
 */

// These are SERVER-SIDE only - never exposed to client
const PINATA_API_KEY = process.env.PINATA_API_KEY || ''
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || ''

export async function POST(request: NextRequest) {
    try {
        // Validate Pinata configuration
        if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
            return NextResponse.json(
                { success: false, error: 'IPFS storage not configured' },
                { status: 500 }
            )
        }

        const formData = await request.formData()
        const file = formData.get('file') as File
        const disputeId = formData.get('disputeId') as string
        const submittedBy = formData.get('submittedBy') as string
        const type = formData.get('type') as string
        const description = formData.get('description') as string

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            )
        }

        // Create Pinata form data
        const pinataFormData = new FormData()
        pinataFormData.append('file', file)

        // Add metadata
        const pinataMetadata = JSON.stringify({
            name: `dispute_${disputeId}_${Date.now()}`,
            keyvalues: {
                disputeId: disputeId || 'unknown',
                submittedBy: submittedBy || 'unknown',
                type: type || 'other',
                description: description || '',
                timestamp: Date.now().toString(),
            }
        })
        pinataFormData.append('pinataMetadata', pinataMetadata)

        // Pin options
        const pinataOptions = JSON.stringify({
            cidVersion: 1,
        })
        pinataFormData.append('pinataOptions', pinataOptions)

        // Upload to Pinata
        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                'pinata_api_key': PINATA_API_KEY,
                'pinata_secret_api_key': PINATA_SECRET_KEY,
            },
            body: pinataFormData,
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('[IPFS] Pinata upload failed:', error)
            return NextResponse.json(
                { success: false, error: 'Failed to upload to IPFS' },
                { status: 500 }
            )
        }

        const result = await response.json()
        const cid = result.IpfsHash
        const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs'

        console.log(`[IPFS] Uploaded evidence: ${cid}`)

        return NextResponse.json({
            success: true,
            cid,
            url: `${gateway}/${cid}`,
        })
    } catch (error) {
        console.error('[IPFS] Upload error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
