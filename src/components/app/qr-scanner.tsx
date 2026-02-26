"use client"

import { useEffect, useRef, useState } from 'react'
import { Camera, Upload, X, Loader2, RotateCcw, Zap } from 'lucide-react'

interface QRScannerProps {
    onScan: (data: string) => void
    onClose?: () => void
}

/**
 * QR Scanner - Matches app widget dimensions (max-w-md)
 * Opens as a modal/page within the app container
 */
export function QRScanner({ onScan, onClose }: QRScannerProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [useFrontCamera, setUseFrontCamera] = useState(false)
    const scannerRef = useRef<any>(null)
    const isMountedRef = useRef(true)

    const startCamera = async (frontCamera: boolean) => {
        try {
            setIsLoading(true)
            setError(null)

            if (scannerRef.current) {
                try { await scannerRef.current.stop() } catch { }
                scannerRef.current = null
            }

            await new Promise(r => setTimeout(r, 200))
            if (!isMountedRef.current) return

            const { Html5Qrcode } = await import('html5-qrcode')
            const devices = await Html5Qrcode.getCameras()

            if (devices.length === 0) throw new Error('No cameras found')

            let cameraId = devices[0].id
            if (!frontCamera && devices.length > 1) {
                const backCam = devices.find(d =>
                    d.label.toLowerCase().includes('back') ||
                    d.label.toLowerCase().includes('rear')
                )
                cameraId = backCam?.id || devices[devices.length - 1].id
            }

            const html5QrCode = new Html5Qrcode('qr-scanner-widget')
            scannerRef.current = html5QrCode

            await html5QrCode.start(
                cameraId,
                { fps: 15, qrbox: { width: 220, height: 220 } },
                (decodedText: string) => {
                    if (isMountedRef.current) onScan(decodedText)
                },
                () => { }
            )

            if (isMountedRef.current) setIsLoading(false)
        } catch (err: any) {
            if (isMountedRef.current) {
                setIsLoading(false)
                setError(err?.message || 'Camera access denied')
            }
        }
    }

    useEffect(() => {
        isMountedRef.current = true
        const timer = setTimeout(() => startCamera(useFrontCamera), 100)

        return () => {
            isMountedRef.current = false
            clearTimeout(timer)
            if (scannerRef.current) {
                try { scannerRef.current.stop().catch(() => { }) } catch { }
            }
        }
    }, [])

    const flipCamera = () => {
        setUseFrontCamera(!useFrontCamera)
        startCamera(!useFrontCamera)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        try {
            const { Html5Qrcode } = await import('html5-qrcode')
            const qr = new Html5Qrcode('qr-file-scanner')
            const text = await qr.scanFile(file, false)
            onScan(text)
        } catch {
            setError('Could not read QR from image')
        }
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header - same as app pages */}
            <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between border-b border-border">
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-surface rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
                <h2 className="font-bold text-lg">Scan QR Code</h2>
                {!isLoading && !error ? (
                    <button
                        onClick={flipCamera}
                        className="p-2 hover:bg-surface rounded-lg transition-colors"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                ) : (
                    <div className="w-9 h-9" />
                )}
            </div>

            {/* Scanner Container - matches app width */}
            <div className="max-w-md mx-auto px-4 py-6">
                {/* Camera View Box */}
                <div className="relative bg-black rounded-xl overflow-hidden aspect-square mb-4">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                            <div className="text-center">
                                <Loader2 className="w-10 h-10 animate-spin text-brand mx-auto mb-3" />
                                <p className="text-white text-sm">Starting camera...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black z-10 p-4">
                            <div className="text-center">
                                <Camera className="w-12 h-12 text-error mx-auto mb-3" />
                                <p className="text-white text-sm mb-4">{error}</p>
                                <label className="px-4 py-2 bg-brand text-white text-sm font-bold rounded-lg cursor-pointer">
                                    Upload Image
                                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Scanner View */}
                    <div id="qr-scanner-widget" className="w-full h-full" />

                    {/* Corner Frame Overlay */}
                    {!isLoading && !error && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="relative w-56 h-56">
                                <div className="absolute top-0 left-0 w-8 h-8 border-l-3 border-t-3 border-brand rounded-tl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-r-3 border-t-3 border-brand rounded-tr"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-3 border-b-3 border-brand rounded-bl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-3 border-b-3 border-brand rounded-br"></div>
                            </div>
                        </div>
                    )}

                    <div id="qr-file-scanner" className="hidden" />
                </div>

                {/* Instructions */}
                <div className="text-center mb-4">
                    <p className="text-sm text-text-secondary">
                        <Zap className="w-4 h-4 inline mr-1 text-brand" />
                        Point at any UPI or payment QR code
                    </p>
                </div>

                {/* Upload Button */}
                <label className="flex items-center justify-center gap-2 w-full py-3 bg-surface border border-border text-text-primary font-medium rounded-lg cursor-pointer hover:border-brand transition-colors">
                    <Upload className="w-5 h-5" />
                    Upload from Gallery
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
            </div>
        </div>
    )
}
