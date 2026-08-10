import React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'

interface ToastProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    variant?: 'info' | 'success' | 'warning' | 'error'
}

export const Toast: React.FC<ToastProps> = ({ open, onOpenChange, title, description, variant = 'info' }) => {
    const variants = {
        info: 'border-[var(--accent)]',
        success: 'border-[var(--success)]',
        warning: 'border-[var(--warning)]',
        error: 'border-[var(--error)]',
    }

    return (
        <ToastPrimitive.Root
            open={open}
            onOpenChange={onOpenChange}
            className={`bg-[var(--bg-elevated)] rounded-lg shadow-[var(--shadow-md)] p-4 border-l-4 ${variants[variant]} animate-slide-up`}
        >
            <ToastPrimitive.Title className="font-medium text-[var(--text-primary)]">
                {title}
            </ToastPrimitive.Title>
            {description && (
                <ToastPrimitive.Description className="text-sm text-[var(--text-secondary)] mt-1">
                    {description}
                </ToastPrimitive.Description>
            )}
        </ToastPrimitive.Root>
    )
}

export const ToastProvider = ToastPrimitive.Provider
export const ToastViewport = ToastPrimitive.Viewport
