import React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

interface ProgressProps {
    value: number  // 0-100
    className?: string
    showLabel?: boolean
}

export const Progress: React.FC<ProgressProps> = ({ value, className = '', showLabel = false }) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <ProgressPrimitive.Root
                className="relative overflow-hidden bg-[var(--bg-tertiary)] rounded-full h-2 flex-1"
                value={value}
            >
                <ProgressPrimitive.Indicator
                    className="bg-[var(--accent)] h-full rounded-full progress-bar-fill"
                    style={{ width: `${value}%` }}
                />
            </ProgressPrimitive.Root>
            {showLabel && (
                <span className="text-xs text-[var(--text-secondary)] min-w-[3ch]">
                    {Math.round(value)}%
                </span>
            )}
        </div>
    )
}
