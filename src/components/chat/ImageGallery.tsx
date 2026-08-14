import React, { useEffect, useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Download, ImageOff } from 'lucide-react'
import { ImagePreviewModal } from './ImagePreviewModal'
import { useI18n } from '../../hooks/useI18n'
import { ChatMessage } from '../../store/chat/chatTypes'

interface ImageGalleryProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    messages: ChatMessage[]
}

type ImageMessage = ChatMessage & { imageData: string }

/**
 * Per-conversation image gallery: a responsive grid of every image message in
 * the current conversation. Clicking a thumbnail opens the shared
 * ImagePreviewModal for full-size viewing; each tile also offers a download.
 *
 * The preview is rendered *inside* the dialog content instead of in a separate
 * portal because Radix disables pointer events outside the modal content while
 * the dialog is open — a fixed overlay elsewhere would not receive clicks. To
 * keep that nested fixed overlay positioned against the viewport (a transformed
 * ancestor would become its containing block), the content spans the full
 * viewport as a transparent flex wrapper around the actual panel.
 */
export const ImageGallery: React.FC<ImageGalleryProps> = ({ open, onOpenChange, messages }) => {
    const { t } = useI18n()
    const [isVisible, setIsVisible] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)
    const [preview, setPreview] = useState<ImageMessage | null>(null)

    const images = useMemo(
        () => messages.filter((m): m is ImageMessage => m.type === 'image' && !!m.imageData),
        [messages],
    )

    useEffect(() => {
        if (open) {
            setIsVisible(true)
            // Trigger animation after mount
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsAnimating(true)
                })
            })
        } else {
            setIsAnimating(false)
            setPreview(null)
            // Wait for exit animation to complete
            const timer = setTimeout(() => {
                setIsVisible(false)
            }, 200)
            return () => clearTimeout(timer)
        }
    }, [open])

    if (!isVisible) return null

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal forceMount>
                <DialogPrimitive.Overlay
                    className={`fixed inset-0 z-50 transition-opacity duration-200 ease-out ${
                        isAnimating ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ backgroundColor: 'var(--overlay)' }}
                />
                <DialogPrimitive.Content
                    className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ease-out ${
                        isAnimating ? 'opacity-100' : 'opacity-0'
                    }`}
                    onEscapeKeyDown={(e) => {
                        // First Escape closes the full-size preview, not the gallery
                        if (preview) e.preventDefault()
                    }}
                >
                    <div
                        className={`relative flex flex-col w-[90vw] max-w-3xl max-h-[85vh] rounded-xl p-6 transition-all duration-200 ease-out ${
                            isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                        style={{
                            backgroundColor: 'var(--bg-elevated)',
                            boxShadow: 'var(--shadow-lg)',
                        }}
                    >
                        <DialogPrimitive.Title className="text-lg font-semibold text-[var(--text-primary)]">
                            {t.gallery}
                        </DialogPrimitive.Title>

                        <div className="mt-4 min-h-0 overflow-y-auto pr-1">
                            {images.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-tertiary)]">
                                    <ImageOff size={40} strokeWidth={1.5} />
                                    <p className="text-sm mt-3">{t.noImages}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                    {images.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className="relative group aspect-square rounded-lg overflow-hidden bg-[var(--bg-secondary)]"
                                        >
                                            <button
                                                onClick={() => setPreview(msg)}
                                                className="w-full h-full cursor-pointer"
                                                title={msg.fileName}
                                            >
                                                <img
                                                    src={msg.imageData}
                                                    alt={msg.fileName || t.sharedImage}
                                                    className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                                                />
                                            </button>
                                            <a
                                                href={msg.imageData}
                                                download={msg.fileName || `image-${msg.timestamp}.png`}
                                                onClick={(e) => e.stopPropagation()}
                                                title={t.downloadImage}
                                                className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <DialogPrimitive.Close className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                        </DialogPrimitive.Close>
                    </div>

                    {/* Full-size preview, kept inside the dialog content so it stays interactive */}
                    <ImagePreviewModal
                        open={!!preview}
                        onClose={() => setPreview(null)}
                        imageData={preview?.imageData || ''}
                        alt={preview?.fileName}
                    />
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
