"use client"

import { useState } from "react"
import { X, AlertTriangle, FileText, Upload, Clock, Loader } from "lucide-react"
import { uploadToIpfs } from "@/lib/ipfs-storage"

export interface DisputeData {
    orderId: string
    reason: string
    description: string
    utr: string
    evidence: File[]
    evidenceUrls: string[]
}

interface DisputeModalProps {
    orderId: string
    orderAmount: number
    merchantName: string
    onSubmit: (dispute: DisputeData) => Promise<void>
    onClose: () => void
}

/**
 * Dispute Resolution Modal
 * Allows users to raise disputes with evidence upload
 */
export function DisputeModal({ orderId, orderAmount, merchantName, onSubmit, onClose }: DisputeModalProps) {
    const [reason, setReason] = useState('')
    const [description, setDescription] = useState('')
    const [utr, setUtr] = useState('')
    const [evidence, setEvidence] = useState<File[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadingFiles, setUploadingFiles] = useState(false)

    const disputeReasons = [
        'Payment not received',
        'Incorrect amount received',
        'Payment method issues',
        'Other (explain below)',
    ]

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files)
            // Limit to 3 files max
            if (evidence.length + newFiles.length > 3) {
                alert('Maximum 3 files allowed')
                return
            }
            setEvidence([...evidence, ...newFiles])
        }
    }

    const removeFile = (index: number) => {
        setEvidence(evidence.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (!reason || !description) return

        setIsSubmitting(true)
        try {
            // Upload evidence files to IPFS
            setUploadingFiles(true)
            const evidenceUrls: string[] = []
            for (const file of evidence) {
                try {
                    const result = await uploadToIpfs(file, {
                        disputeId: orderId,
                        submittedBy: 'user',
                        type: 'other',
                        description: reason,
                        timestamp: Date.now(),
                    })
                    if (result.success && result.url) {
                        evidenceUrls.push(result.url)
                    }
                } catch (err) {
                    console.error('Failed to upload file:', file.name, err)
                }
            }
            setUploadingFiles(false)

            await onSubmit({
                orderId,
                reason,
                description,
                utr,
                evidence,
                evidenceUrls,
            })
            onClose()
        } catch (error) {
            console.error('Failed to submit dispute:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-surface">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-error" />
                        <h3 className="font-bold text-text-primary">Raise Dispute</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-background rounded"
                    >
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Warning */}
                    <div className="bg-warning/10 border border-warning/20 p-3">
                        <p className="text-xs text-warning font-bold mb-1">⚠️ Important</p>
                        <p className="text-xs text-text-secondary">
                            Only raise a dispute if there's a genuine issue. False disputes may affect your reputation.
                        </p>
                    </div>

                    {/* SLA Banner */}
                    <div className="bg-brand/10 border border-brand/30 p-3 flex items-center gap-3">
                        <Clock className="w-8 h-8 text-brand" />
                        <div>
                            <p className="text-sm font-bold text-brand">{"<"} 4 Hour Resolution</p>
                            <p className="text-xs text-text-secondary">
                                We commit to reviewing and resolving your dispute within 4 hours
                            </p>
                        </div>
                    </div>

                    {/* Order Info */}
                    <div className="bg-background border border-border p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">Order ID:</span>
                            <span className="font-mono text-xs text-text-primary">{orderId.slice(0, 16)}...</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">Merchant:</span>
                            <span className="text-text-primary">{merchantName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-text-secondary">Amount:</span>
                            <span className="font-bold text-brand">{orderAmount.toFixed(2)} USDC</span>
                        </div>
                    </div>

                    {/* Reason Selection */}
                    <div>
                        <label className="text-xs text-text-secondary uppercase mb-2 block">
                            Dispute Reason *
                        </label>
                        <div className="space-y-2">
                            {disputeReasons.map((reasonOption) => (
                                <button
                                    key={reasonOption}
                                    onClick={() => setReason(reasonOption)}
                                    className={`w-full p-3 border text-left text-sm transition-colors ${reason === reasonOption
                                            ? 'border-brand bg-brand/10 text-text-primary'
                                            : 'border-border bg-background text-text-secondary hover:border-text-secondary'
                                        }`}
                                >
                                    {reasonOption}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs text-text-secondary uppercase mb-2 block">
                            Detailed Description *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explain the issue in detail..."
                            className="w-full p-3 bg-background border border-border text-text-primary text-sm min-h-[120px] focus:border-brand outline-none resize-none"
                            maxLength={500}
                        />
                        <p className="text-xs text-text-secondary mt-1">
                            {description.length}/500 characters
                        </p>
                    </div>

                    {/* UTR Number */}
                    <div>
                        <label className="text-xs text-text-secondary uppercase mb-2 block">
                            UTR / Transaction Reference
                        </label>
                        <input
                            type="text"
                            value={utr}
                            onChange={(e) => setUtr(e.target.value.toUpperCase())}
                            placeholder="Enter your payment UTR number"
                            className="w-full p-3 bg-background border border-border text-text-primary text-sm font-mono focus:border-brand outline-none"
                        />
                        <p className="text-xs text-text-secondary mt-1">
                            Found in your UPI app payment history. Helps verify your payment.
                        </p>
                    </div>

                    {/* Evidence Upload */}
                    <div>
                        <label className="text-xs text-text-secondary uppercase mb-2 block">
                            Evidence (Screenshots, Receipts) - Max 3 files
                        </label>

                        <label className={`w-full p-4 border-2 border-dashed bg-background transition-colors cursor-pointer flex flex-col items-center gap-2 ${
                            evidence.length >= 3 ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-brand'
                        }`}>
                            <Upload className="w-6 h-6 text-text-secondary" />
                            <span className="text-xs text-text-secondary">
                                {evidence.length >= 3 ? 'Maximum files reached' : 'Click to upload files'}
                            </span>
                            <input
                                type="file"
                                multiple
                                accept="image/*,.pdf"
                                onChange={handleFileUpload}
                                disabled={evidence.length >= 3}
                                className="hidden"
                            />
                        </label>

                        {/* Uploaded Files */}
                        {evidence.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {evidence.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-2 bg-background border border-border"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-brand" />
                                            <span className="text-xs text-text-primary truncate max-w-[200px]">
                                                {file.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="p-1 hover:bg-surface rounded"
                                        >
                                            <X className="w-4 h-4 text-text-secondary" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 space-y-3">
                        <button
                            onClick={handleSubmit}
                            disabled={!reason || !description || isSubmitting}
                            className="w-full bg-error text-white font-bold py-3 uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    {uploadingFiles ? 'Uploading Evidence...' : 'Submitting...'}
                                </>
                            ) : (
                                'Submit Dispute'
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full bg-surface border border-border text-text-primary font-bold py-3 uppercase hover:border-brand transition-colors"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* Info */}
                    <div className="bg-brand/10 border border-brand/20 p-3">
                        <p className="text-xs font-bold text-brand mb-1">What happens next?</p>
                        <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside">
                            <li>Your dispute is queued for immediate review</li>
                            <li>Our team reviews evidence within 4 hours</li>
                            <li>UTR and screenshots are verified</li>
                            <li>Resolution is executed on-chain</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    )
}
