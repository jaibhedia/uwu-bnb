"use client"

import { useState } from 'react'
import { CheckCircle, Upload, AlertCircle, Loader2, Shield } from 'lucide-react'
import { usePaymentVerification, type PaymentProof } from '@/hooks/usePaymentVerification'

interface PaymentProofUploadProps {
    orderId: string
    expectedAmount: number          // Fiat amount (INR)
    onVerified: () => void
    onError?: (error: Error) => void
}

export function PaymentProofUpload({
    orderId,
    expectedAmount,
    onVerified,
    onError,
}: PaymentProofUploadProps) {
    const [utr, setUtr] = useState('')
    const [screenshot, setScreenshot] = useState<string | null>(null)
    const [screenshotName, setScreenshotName] = useState('')
    const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'review' | 'failed'>('idle')
    const [message, setMessage] = useState('')

    const { verifyPayment, quickValidateUTR, isVerifying } = usePaymentVerification()

    const utrValidation = quickValidateUTR(utr)

    const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setMessage('Please upload an image file')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setMessage('Image must be less than 5MB')
            return
        }

        setScreenshotName(file.name)

        // Convert to base64
        const reader = new FileReader()
        reader.onload = () => {
            setScreenshot(reader.result as string)
            setMessage('')
        }
        reader.readAsDataURL(file)
    }

    const handleSubmit = async () => {
        if (!utrValidation.valid) return

        setStatus('verifying')
        setMessage('')

        try {
            const proof: PaymentProof = {
                orderId,
                utr: utr.replace(/\s/g, ''),
                amount: expectedAmount,
                timestamp: Date.now(),
                screenshot: screenshot || undefined,
            }

            const result = await verifyPayment(proof)

            if (result.autoRelease) {
                setStatus('success')
                setMessage('Payment verified! USDC released automatically.')
                onVerified()
            } else if (result.requiresReview) {
                setStatus('review')
                setMessage('Payment submitted for review. Will complete in 5-10 minutes.')
            } else {
                setStatus('failed')
                setMessage('Verification failed. A dispute has been created.')
                onError?.(new Error('Verification failed'))
            }
        } catch (error) {
            setStatus('failed')
            setMessage('Something went wrong. Please try again.')
            onError?.(error instanceof Error ? error : new Error('Unknown error'))
        }
    }

    return (
        <div className="bg-black border border-border p-4 font-mono">
            <h3 className="text-sm font-bold text-brand uppercase mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                SUBMIT_PAYMENT_PROOF
            </h3>

            {/* UTR Input */}
            <div className="mb-4">
                <label className="text-[10px] text-text-secondary uppercase block mb-2">
                    {">"} UPI_TRANSACTION_ID (UTR)
                </label>
                <input
                    type="text"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                    placeholder="123456789012"
                    maxLength={12}
                    disabled={status === 'verifying' || status === 'success'}
                    className="w-full bg-surface/20 border border-border p-3 text-white font-mono 
                             focus:border-brand outline-none placeholder:text-gray-700 text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className={`text-[10px] mt-1 uppercase ${utrValidation.valid ? 'text-success' : 'text-text-secondary'}`}>
                    {utrValidation.message}
                </div>
            </div>

            {/* Screenshot Upload */}
            <div className="mb-4">
                <label className="text-[10px] text-text-secondary uppercase block mb-2">
                    {">"} PAYMENT_SCREENSHOT (OPTIONAL)
                </label>
                <div className="relative">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        disabled={status === 'verifying' || status === 'success'}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className={`border border-dashed border-border p-4 text-center transition-colors
                                   ${screenshot ? 'border-success bg-success/5' : 'hover:border-brand/50'}`}>
                        {screenshot ? (
                            <div className="flex items-center justify-center gap-2 text-success">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs">{screenshotName}</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-text-secondary">
                                <Upload className="w-4 h-4" />
                                <span className="text-xs uppercase">Click to upload</span>
                            </div>
                        )}
                    </div>
                </div>
                <p className="text-[10px] text-text-secondary mt-1 uppercase opacity-70">
                    Higher confidence = faster release (optional but recommended)
                </p>
            </div>

            {/* Status Messages */}
            {message && (
                <div className={`p-3 mb-4 border flex items-center gap-2 text-xs uppercase
                    ${status === 'success' ? 'border-success bg-success/10 text-success' :
                        status === 'review' ? 'border-warning bg-warning/10 text-warning' :
                            status === 'failed' ? 'border-error bg-error/10 text-error' :
                                'border-brand bg-brand/10 text-brand'}`}>
                    {status === 'success' && <CheckCircle className="w-4 h-4" />}
                    {status === 'review' && <Loader2 className="w-4 h-4 animate-spin" />}
                    {status === 'failed' && <AlertCircle className="w-4 h-4" />}
                    <span>{message}</span>
                </div>
            )}

            {/* Submit Button */}
            {status !== 'success' && (
                <button
                    onClick={handleSubmit}
                    disabled={!utrValidation.valid || isVerifying || status === 'verifying'}
                    className="w-full py-4 bg-brand text-black font-bold uppercase tracking-wider text-sm
                             disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover 
                             transition-colors flex items-center justify-center gap-2"
                >
                    {isVerifying || status === 'verifying' ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            VERIFYING...
                        </>
                    ) : (
                        <>
                            <Shield className="w-4 h-4" />
                            SUBMIT_PROOF
                        </>
                    )}
                </button>
            )}

            {/* Confidence Info */}
            <div className="mt-4 p-3 border border-border/50 bg-surface/10">
                <p className="text-[10px] text-text-secondary uppercase">
                    {">"} AUTO_RELEASE_THRESHOLD: 85% CONFIDENCE<br />
                    {">"} MANUAL_REVIEW: 70-85% CONFIDENCE<br />
                    {">"} UTR_ONLY: ~15% | +SCREENSHOT: ~40% | +BANK_API: ~100%
                </p>
            </div>
        </div>
    )
}
