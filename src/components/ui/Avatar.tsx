import React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'

interface AvatarProps {
    src?: string
    fallback: string
    size?: 'sm' | 'md' | 'lg'
    status?: 'online' | 'offline'
    className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ src, fallback, size = 'md', status, className = '' }) => {
    const sizes = {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
    }

    const statusSizes = {
        sm: 'h-2.5 w-2.5',
        md: 'h-3 w-3',
        lg: 'h-3.5 w-3.5',
    }

    return (
        <div className={`relative inline-flex ${className}`}>
            <AvatarPrimitive.Root className={`relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[var(--bg-tertiary)] ${sizes[size]}`}>
                <AvatarPrimitive.Image
                    className="w-full h-full object-cover"
                    src={src}
                />
                <AvatarPrimitive.Fallback
                    className="flex items-center justify-center w-full h-full bg-[var(--accent)] text-white font-medium"
                    delayMs={0}
                >
                    {fallback.charAt(0).toUpperCase()}
                </AvatarPrimitive.Fallback>
            </AvatarPrimitive.Root>
            {status && (
                <span className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-[var(--bg-primary)] ${statusSizes[size]} ${status === 'online' ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]'}`} />
            )}
        </div>
    )
}
