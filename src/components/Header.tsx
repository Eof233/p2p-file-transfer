import React, { useState } from 'react'
import { Button } from './ui/Button'
import { Tooltip } from './ui/Tooltip'
import { SettingsDialog } from './settings/SettingsDialog'
import { truncateId } from '../utils/formatters'
import { useI18n } from '../hooks/useI18n'
import { useTheme } from '../hooks/useTheme'

interface HeaderProps {
    myId?: string
    isStarted: boolean
    onStart: () => void
    onStop: () => void
    onCopyId?: () => void
    loading?: boolean
}

export const Header: React.FC<HeaderProps> = ({ myId, isStarted, onStart, onStop, onCopyId, loading }) => {
    const [settingsOpen, setSettingsOpen] = useState(false)
    const { t } = useI18n()
    // Initialize theme on mount
    useTheme()

    return (
        <>
            <header className="flex items-center justify-between px-4 h-14 bg-[var(--bg-primary)] border-b border-[var(--separator)]">
                <div className="flex items-center gap-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t.appTitle}</h1>
                </div>

                <div className="flex items-center gap-2">
                    {isStarted && myId && (
                        <Tooltip content={t.copyId}>
                            <button
                                onClick={onCopyId}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                                <code className="text-xs font-mono text-[var(--text-secondary)]">
                                    {truncateId(myId, 12)}
                                </code>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                            </button>
                        </Tooltip>
                    )}

                    {!isStarted ? (
                        <Button variant="primary" size="sm" onClick={onStart} disabled={loading}>
                            {loading ? t.stopping : t.startSession}
                        </Button>
                    ) : (
                        <Button variant="danger" size="sm" onClick={onStop}>
                            {t.stop}
                        </Button>
                    )}

                    <Tooltip content={t.settings}>
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </button>
                    </Tooltip>
                </div>
            </header>

            <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </>
    )
}
