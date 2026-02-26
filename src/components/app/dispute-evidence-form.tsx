"use client"

import { useState, useCallback } from 'react'
import { Upload, FileImage, FileText, X, Check, Loader2, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadToIpfs, type EvidenceMetadata } from '@/lib/ipfs-storage'

interface DisputeEvidenceFormProps {
    orderId: string
    userAddress: string
    onSubmit: (evidence: DisputeEvidence) => void
    onCancel?: () => void
}

export interface DisputeEvidence {
    orderId: string
    submittedBy: string
    utrReference: string
    explanation: string
    screenshots: UploadedFile[]
    timestamp: number
}

interface UploadedFile {
    name: string
    type: string
    cid: string
    url: string
}

/**
 * Dispute Evidence Collection Form
 * 
 * Collects:
 * - UTR Reference (payment proof)
 * - Text explanation of issue
 * - Screenshot uploads (max 3)
 */
export function DisputeEvidenceForm({ 
    orderId, 
    userAddress, 
    onSubmit,
    onCancel 
}: DisputeEvidenceFormProps) {
    const [utrReference, setUtrReference] = useState('')
    const [explanation, setExplanation] = useState('')
    const [screenshots, setScreenshots] = useState<UploadedFile[]>([])
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return
        if (screenshots.length >= 3) {
            setError('Maximum 3 screenshots allowed')
            return
        }

        setUploading(true)
        setError(null)

        try {
            for (const file of Array.from(files)) {
                if (screenshots.length >= 3) break

                // Validate file
                if (!file.type.startsWith('image/')) {
                    setError('Only image files are allowed')
                    continue
                }
                if (file.size > 5 * 1024 * 1024) {
                    setError('File size must be under 5MB')
                    continue
                }

                const metadata: EvidenceMetadata = {
                    disputeId: orderId,
                    submittedBy: userAddress,
                    type: 'screenshot',
                    description: `Evidence for dispute ${orderId}`,
                    fileName: file.name,
                    timestamp: Date.now()
                }

                const result = await uploadToIpfs(file, metadata)

                if (result.success && result.cid) {
                    setScreenshots(prev => [...prev, {
                        name: file.name,
                        type: file.type,
                        cid: result.cid!,
                        url: result.url!
                    }])
                } else {
                    setError(result.error || 'Upload failed')
                }
            }
        } catch (err) {
            console.error('Upload error:', err)
            setError('Failed to upload file')
        } finally {
            setUploading(false)
        }
    }, [orderId, userAddress, screenshots.length])

    const removeScreenshot = (index: number) => {
        setScreenshots(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        // Validation
        if (!utrReference.trim()) {
            setError('UTR reference is required')
            return
        }
        if (!explanation.trim() || explanation.length < 20) {
            setError('Please provide a detailed explanation (at least 20 characters)')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const evidence: DisputeEvidence = {
                orderId,
                submittedBy: userAddress,
                utrReference: utrReference.trim(),
                explanation: explanation.trim(),
                screenshots,
                timestamp: Date.now()
            }

            onSubmit(evidence)
        } catch (err) {
            console.error('Submit error:', err)
            setError('Failed to submit dispute')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="bg-surface border border-border p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-bold text-text-primary">Submit Dispute Evidence</h3>
                    <p className="text-sm text-text-secondary mt-1">
                        Provide evidence to support your dispute. Resolution within 4 hours.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-warning">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">4hr resolution</span>
                </div>
            </div>

            {/* UTR Reference */}
            <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                    UTR / Transaction Reference *
                </label>
                <input
                    type="text"
                    value={utrReference}
                    onChange={(e) => setUtrReference(e.target.value)}
                    placeholder="Enter UTR number from your payment"
                    className="w-full bg-background border border-border px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-brand"
                />
                <p className="text-xs text-text-secondary mt-1">
                    Find this in your UPI app under transaction details
                </p>
            </div>

            {/* Explanation */}
            <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                    Explanation *
                </label>
                <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Describe what happened in detail. Include timestamps, amounts, and any relevant information..."
                    rows={4}
                    className="w-full bg-background border border-border px-4 py-3 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-brand resize-none"
                />
                <p className="text-xs text-text-secondary mt-1">
                    {explanation.length}/500 characters (minimum 20)
                </p>
            </div>

            {/* Screenshot Upload */}
            <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                    Screenshots (Optional, max 3)
                </label>
                
                {/* Uploaded files */}
                {screenshots.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {screenshots.map((file, index) => (
                            <div 
                                key={file.cid}
                                className="flex items-center justify-between bg-background border border-border p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <FileImage className="w-5 h-5 text-brand" />
                                    <div>
                                        <p className="text-sm text-text-primary">{file.name}</p>
                                        <p className="text-xs text-text-secondary font-mono">
                                            {file.cid.slice(0, 20)}...
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeScreenshot(index)}
                                    className="p-1 hover:bg-error/10 rounded"
                                >
                                    <X className="w-4 h-4 text-error" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upload zone */}
                {screenshots.length < 3 && (
                    <label className="block cursor-pointer">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileUpload(e.target.files)}
                            className="hidden"
                            disabled={uploading}
                        />
                        <div className={`
                            border-2 border-dashed border-border p-6 text-center
                            hover:border-brand hover:bg-brand/5 transition-colors
                            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                        `}>
                            {uploading ? (
                                <Loader2 className="w-8 h-8 mx-auto mb-2 text-brand animate-spin" />
                            ) : (
                                <Upload className="w-8 h-8 mx-auto mb-2 text-text-secondary" />
                            )}
                            <p className="text-sm text-text-secondary">
                                {uploading 
                                    ? 'Uploading...' 
                                    : 'Click or drag to upload screenshots'
                                }
                            </p>
                            <p className="text-xs text-text-secondary mt-1">
                                PNG, JPG up to 5MB each
                            </p>
                        </div>
                    </label>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-error bg-error/10 border border-error/20 p-3">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
                {onCancel && (
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={submitting}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    onClick={handleSubmit}
                    disabled={submitting || uploading || !utrReference || !explanation}
                    className="flex-1 bg-brand hover:bg-brand/90"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4 mr-2" />
                            Submit Dispute
                        </>
                    )}
                </Button>
            </div>

            {/* Info box */}
            <div className="bg-brand/5 border border-brand/20 p-4">
                <h4 className="text-sm font-medium text-brand mb-2">What happens next?</h4>
                <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside">
                    <li>Our team will review your evidence within 4 hours</li>
                    <li>We may contact you for additional information</li>
                    <li>Resolution will be posted and funds released/refunded</li>
                    <li>False claims may result in account suspension</li>
                </ol>
            </div>
        </div>
    )
}
