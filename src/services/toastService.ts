/**
 * Tiny publish/subscribe toast bus. Components call `toast(...)` from
 * anywhere (hooks, thunks, callbacks); the App-level <ToastViewport> renders
 * the active toasts. Kept as plain functions so non-React code can use it.
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastInput {
    title: string
    description?: string
    variant?: ToastVariant
}

type Listener = (toast: ToastInput) => void

const listeners: Set<Listener> = new Set()

export const toast = (input: ToastInput): void => {
    listeners.forEach((listener) => listener(input))
}

export const subscribeToasts = (listener: Listener): (() => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
