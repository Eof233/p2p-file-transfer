import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className = '', ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5">
                {label && (
                    <label className="text-sm font-medium text-[var(--text-secondary)]">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`h-10 px-3 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--separator)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-colors ${className}`}
                    {...props}
                />
                {error && (
                    <span className="text-xs text-[var(--error)]">{error}</span>
                )}
            </div>
        )
    }
)
Input.displayName = 'Input'
