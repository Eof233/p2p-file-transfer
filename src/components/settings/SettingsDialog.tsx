import React, { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { useAppSelector, useAppDispatch } from '../../store/hooks'
import { SettingsActionType } from '../../store/settings/settingsTypes'
import { useI18n } from '../../hooks/useI18n'
import { useTheme } from '../../hooks/useTheme'
import { Language } from '../../utils/i18n'
import { LogViewer } from './LogViewer'

interface SettingsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onOpenChange }) => {
    const dispatch = useAppDispatch()
    const settings = useAppSelector((state) => state.settings)
    const { t, language, setLanguage } = useI18n()
    const { theme, setTheme } = useTheme()
    const [logViewerOpen, setLogViewerOpen] = useState(false)

    const handleEncryptionToggle = () => {
        dispatch({ type: SettingsActionType.SETTINGS_ENCRYPTION_TOGGLE })
    }

    const handleNotificationsToggle = () => {
        const nextEnabled = !settings.notificationsEnabled
        if (nextEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {
                // Permission denied or unsupported: still allow the toggle,
                // notifications simply won't show until granted.
            })
        }
        dispatch({ type: SettingsActionType.SETTINGS_NOTIFICATIONS_TOGGLE })
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            title={t.settings}
        >
            <div className="flex flex-col gap-6">
                {/* Language */}
                <div>
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{t.language}</h3>
                    <div className="flex gap-2">
                        {(['en', 'zh'] as Language[]).map(lang => (
                            <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    language === lang
                                        ? 'bg-[var(--accent)] text-white'
                                        : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                {lang === 'en' ? 'English' : '中文'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Theme */}
                <div>
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{t.appearance}</h3>
                    <div className="flex gap-2">
                        {(['light', 'dark', 'system'] as const).map(themeOption => (
                            <button
                                key={themeOption}
                                onClick={() => setTheme(themeOption)}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                    theme === themeOption
                                        ? 'bg-[var(--accent)] text-white'
                                        : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                {t[themeOption]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Security */}
                <div>
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{t.security}</h3>
                    <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">{t.endToEndEncryption}</div>
                            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{t.encryptionDesc}</div>
                        </div>
                        <button
                            onClick={handleEncryptionToggle}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                settings.encryptionEnabled ? 'bg-[var(--success)]' : 'bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                settings.encryptionEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>
                </div>

                {/* Notifications */}
                <div>
                    <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{t.notifications}</h3>
                    <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">{t.enableNotifications}</div>
                            <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{t.notificationsDesc}</div>
                        </div>
                        <button
                            onClick={handleNotificationsToggle}
                            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                settings.notificationsEnabled ? 'bg-[var(--success)]' : 'bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                settings.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                        </button>
                    </div>
                </div>

                {/* About */}
                <div className="pt-4 border-t border-[var(--separator)]">
                    <div className="text-center text-xs text-[var(--text-tertiary)]">
                        <p>P2P Messenger v1.0.0</p>
                        <p className="mt-1">{t.secureP2P}</p>
                    </div>
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={() => setLogViewerOpen(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                            {t.logViewer}
                        </button>
                    </div>
                </div>
            </div>
            <LogViewer open={logViewerOpen} onClose={() => setLogViewerOpen(false)} />
        </Dialog>
    )
}
