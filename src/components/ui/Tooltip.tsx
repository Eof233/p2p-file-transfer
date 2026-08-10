import React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

interface TooltipProps {
    children: React.ReactNode
    content: string
    side?: 'top' | 'right' | 'bottom' | 'left'
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, side = 'top' }) => {
    return (
        <TooltipPrimitive.Provider delayDuration={300}>
            <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                    {children}
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                        side={side}
                        sideOffset={4}
                        className="bg-[var(--text-primary)] text-[var(--bg-primary)] px-2 py-1 rounded text-xs font-medium animate-fade-in z-50"
                    >
                        {content}
                        <TooltipPrimitive.Arrow className="fill-[var(--text-primary)]" />
                    </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
    )
}
