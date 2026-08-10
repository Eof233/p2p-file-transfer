import React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'

interface ScrollAreaProps {
    children: React.ReactNode
    className?: string
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, className = '' }) => {
    return (
        <ScrollAreaPrimitive.Root className={`overflow-hidden ${className}`}>
            <ScrollAreaPrimitive.Viewport className="w-full h-full">
                {children}
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.Scrollbar
                className="flex select-none touch-none p-0.5 bg-transparent transition-colors duration-150 data-[orientation=vertical]:w-2 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2"
                orientation="vertical"
            >
                <ScrollAreaPrimitive.Thumb className="flex-1 bg-[var(--text-tertiary)] rounded-full opacity-50 hover:opacity-100 transition-opacity" />
            </ScrollAreaPrimitive.Scrollbar>
        </ScrollAreaPrimitive.Root>
    )
}
