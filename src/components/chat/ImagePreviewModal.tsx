import React, { useEffect } from 'react'
import { useI18n } from '../../hooks/useI18n'

interface ImagePreviewModalProps {
    open: boolean
    onClose: () => void
    imageData: string
    alt?: string
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ open, onClose, imageData, alt }) => {
    const { t } = useI18n()

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (open) {
            document.addEventListener('keydown', handleEscape)
            return () => document.removeEventListener('keydown', handleEscape)
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Image */}
            <div className="relative max-w-[90vw] max-h-[90vh] animate-scale-in" onClick={e => e.stopPropagation()}>
                <img
                    src={imageData}
                    alt={alt || t.preview}
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                />

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    title={t.closePreview}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Download button */}
                <a
                    href={imageData}
                    download={`image-${Date.now()}.png`}
                    className="absolute bottom-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    onClick={e => e.stopPropagation()}
                    title={t.downloadImage}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                </a>
            </div>
        </div>
    )
}
