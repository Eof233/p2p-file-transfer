import React from 'react'
import { useConnectionStats } from '../../hooks/useConnectionStats'
import { useI18n } from '../../hooks/useI18n'
import { formatFileSize } from '../../utils/formatters'

interface ConnectionInfoProps {
    peerId: string
}

export const ConnectionInfo: React.FC<ConnectionInfoProps> = ({ peerId }) => {
    const { stats, loading, refresh } = useConnectionStats(peerId)
    const { t } = useI18n()

    if (!stats) return null

    const qualityColors: Record<string, string> = {
        excellent: 'text-[var(--success)]',
        good: 'text-[var(--warning)]',
        poor: 'text-[var(--error)]',
        unknown: 'text-[var(--text-tertiary)]',
    }

    const qualityLabels: Record<string, string> = {
        excellent: t.excellent,
        good: t.good,
        poor: t.poor,
        unknown: t.unknown,
    }

    return (
        <div className="flex items-center gap-3 px-3 py-1.5 bg-[var(--bg-secondary)] rounded-lg text-xs">
            {/* Quality indicator */}
            <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${
                    stats.quality === 'excellent' ? 'bg-[var(--success)]' :
                    stats.quality === 'good' ? 'bg-[var(--warning)]' :
                    stats.quality === 'poor' ? 'bg-[var(--error)]' :
                    'bg-[var(--text-tertiary)]'
                }`} />
                <span className={qualityColors[stats.quality || 'unknown']}>
                    {qualityLabels[stats.quality || 'unknown']}
                </span>
            </div>

            {/* Latency */}
            {stats.latency !== undefined && (
                <div className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-[var(--text-secondary)]">
                        {stats.latency}ms
                    </span>
                </div>
            )}

            {/* Remote address */}
            {stats.remoteAddress && (
                <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span>{stats.remoteAddress}{stats.remotePort ? `:${stats.remotePort}` : ''}</span>
                </div>
            )}

            {/* Data transferred */}
            {(stats.bytesReceived || stats.bytesSent) ? (
                <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="7 13 12 18 17 13" />
                        <polyline points="7 6 12 11 17 6" />
                    </svg>
                    <span>↑{formatFileSize(stats.bytesSent || 0)} ↓{formatFileSize(stats.bytesReceived || 0)}</span>
                </div>
            ) : null}

            {/* Refresh button */}
            <button
                onClick={refresh}
                className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'animate-spin' : ''}>
                    <path d="M23 4v6h-6" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
            </button>
        </div>
    )
}
