import React, { useEffect, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

interface DialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: string
    description?: string
    children: React.ReactNode
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, title, description, children }) => {
    const [isVisible, setIsVisible] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

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
                    className={`fixed top-1/2 left-1/2 z-50 w-[90vw] max-w-md rounded-xl p-6 transition-all duration-200 ease-out ${
                        isAnimating
                            ? 'opacity-100 translate-x-[-50%] translate-y-[-50%] scale-100'
                            : 'opacity-0 translate-x-[-50%] translate-y-[-48%] scale-95'
                    }`}
                    style={{
                        backgroundColor: 'var(--bg-elevated)',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    {title && (
                        <DialogPrimitive.Title className="text-lg font-semibold text-[var(--text-primary)]">
                            {title}
                        </DialogPrimitive.Title>
                    )}
                    {description && (
                        <DialogPrimitive.Description className="text-sm text-[var(--text-secondary)] mt-1">
                            {description}
                        </DialogPrimitive.Description>
                    )}
                    <div className="mt-4">{children}</div>
                    <DialogPrimitive.Close className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                    </DialogPrimitive.Close>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
