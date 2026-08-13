import { useEffect, useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { SettingsActionType, Theme } from '../store/settings/settingsTypes'
import { STORAGE_KEYS } from '../utils/constants'

export const useTheme = () => {
    const dispatch = useAppDispatch()
    const theme = useAppSelector((state) => state.settings.theme)

    // Apply theme to document
    useEffect(() => {
        const root = document.documentElement

        // Remove existing theme attributes
        root.removeAttribute('data-theme')

        if (theme === 'system') {
            // Let CSS media query handle it
            return
        }

        // Apply explicit theme
        root.setAttribute('data-theme', theme)
    }, [theme])

    // Listen for system theme changes when in system mode
    useEffect(() => {
        if (theme !== 'system') return

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            // Force re-render by toggling a class
            document.documentElement.classList.remove('theme-transition')
            requestAnimationFrame(() => {
                document.documentElement.classList.add('theme-transition')
            })
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [theme])

    const setTheme = useCallback((newTheme: Theme) => {
        dispatch({ type: SettingsActionType.SETTINGS_THEME_SET, theme: newTheme })
        // Save to localStorage
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS)
            const settings = stored ? JSON.parse(stored) : {}
            settings.theme = newTheme
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
        } catch {}
    }, [dispatch])

    return {
        theme,
        setTheme,
    }
}
