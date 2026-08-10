import React from 'react'
import { Slot } from '@radix-ui/react-slot'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', asChild, className = '', children, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button'

        const baseStyles = 'press-feedback inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-50 disabled:pointer-events-none'

        const variants = {
            primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
            secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--separator)]',
            ghost: 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]',
            danger: 'bg-[var(--error)] text-white hover:opacity-90',
        }

        const sizes = {
            sm: 'h-8 px-3 text-sm',
            md: 'h-10 px-4 text-sm',
            lg: 'h-12 px-6 text-base',
        }

        return (
            <Comp
                ref={ref}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                {...props}
            >
                {children}
            </Comp>
        )
    }
)
Button.displayName = 'Button'
