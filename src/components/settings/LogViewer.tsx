import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { logger, LogLevel, LogEntry } from '../../services/logService'
import { useI18n } from '../../hooks/useI18n'

interface LogViewerProps {
    open: boolean
    onClose: () => void
}

export const LogViewer: React.FC<LogViewerProps> = ({ open, onClose }) => {
    const { t } = useI18n()
    const [levelFilter, setLevelFilter] = useState<LogLevel | null>(null)
    const [moduleFilter, setModuleFilter] = useState<string>('')
    const [errorsOnly, setErrorsOnly] = useState(false)

    // Live view: re-snapshot when the viewer opens and subscribe to the log
    // service so new entries appear in real time without manual refresh.
    const [allLogs, setAllLogs] = useState<LogEntry[]>([])
    useEffect(() => {
        if (!open) return
        setAllLogs(logger.getLogs())
        return logger.subscribe(() => setAllLogs(logger.getLogs()))
    }, [open])

    const logs = useMemo(() => {
        let filtered = allLogs
        if (errorsOnly) {
            filtered = filtered.filter(log => log.level === LogLevel.ERROR || log.level === LogLevel.FATAL)
        }
        if (levelFilter !== null) {
            filtered = filtered.filter(log => log.level === levelFilter)
        }
        if (moduleFilter) {
            filtered = filtered.filter(log => log.module.includes(moduleFilter))
        }
        return filtered.reverse() // Newest first
    }, [allLogs, errorsOnly, levelFilter, moduleFilter])

    const modules = useMemo(() => {
        const moduleSet = new Set(allLogs.map(log => log.module))
        return Array.from(moduleSet).sort()
    }, [allLogs])

    const levelColors: Record<LogLevel, string> = {
        [LogLevel.DEBUG]: 'text-[var(--text-tertiary)]',
        [LogLevel.INFO]: 'text-[var(--accent)]',
        [LogLevel.WARN]: 'text-[var(--warning)]',
        [LogLevel.ERROR]: 'text-[var(--error)]',
        [LogLevel.FATAL]: 'text-[var(--error)] font-bold',
    }

    const levelLabels: Record<LogLevel, string> = {
        [LogLevel.DEBUG]: 'DBG',
        [LogLevel.INFO]: 'INF',
        [LogLevel.WARN]: 'WRN',
        [LogLevel.ERROR]: 'ERR',
        [LogLevel.FATAL]: 'FTL',
    }

    const handleExportJSON = () => {
        const json = logger.exportAsJSON()
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `p2p-messenger-logs-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleExportCSV = () => {
        const csv = logger.exportAsCSV()
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `p2p-messenger-logs-${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleClear = () => {
        // clearLogs() notifies subscribers, so the live list updates itself
        logger.clearLogs()
    }

    const handleRefresh = () => {
        setAllLogs(logger.getLogs())
    }

    // --- Auto stick-to-bottom when new entries arrive ---------------------
    // Only follow new logs when the user is already near the bottom; if they
    // scrolled up to inspect something, keep their position.
    const scrollRef = useRef<HTMLDivElement>(null)
    const stickToBottomRef = useRef(true)

    const handleScroll = () => {
        const el = scrollRef.current
        if (el) {
            stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }
    }

    useLayoutEffect(() => {
        if (stickToBottomRef.current && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs])

    if (!open) return null

    // Render into document.body so the fullscreen overlay is always relative
    // to the viewport — never to a transformed ancestor (a transform on a
    // parent becomes the containing block for fixed-positioned descendants,
    // which would shrink/clip the overlay to that ancestor's box).
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className="bg-[var(--bg-elevated)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--separator)]">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t.logViewer || 'Log Viewer'}</h2>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleRefresh}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleExportJSON}>JSON</Button>
                        <Button variant="ghost" size="sm" onClick={handleExportCSV}>CSV</Button>
                        <Button variant="ghost" size="sm" onClick={handleClear}>{t.clearLogs || 'Clear'}</Button>
                        <Button
                            variant={errorsOnly ? 'primary' : 'ghost'}
                            size="sm"
                            aria-pressed={errorsOnly}
                            onClick={() => setErrorsOnly(!errorsOnly)}
                        >
                            {t.errorsFilter}
                        </Button>
                        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 p-3 border-b border-[var(--separator)] bg-[var(--bg-secondary)]">
                    <span className="text-xs text-[var(--text-tertiary)]">{t.level || 'Level'}:</span>
                    {[null, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR].map(level => (
                        <button
                            key={level ?? 'all'}
                            onClick={() => setLevelFilter(level)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                levelFilter === level
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--separator)]'
                            }`}
                        >
                            {level === null ? 'ALL' : levelLabels[level]}
                        </button>
                    ))}
                    <span className="text-xs text-[var(--text-tertiary)] ml-2">{t.module || 'Module'}:</span>
                    <select
                        value={moduleFilter}
                        onChange={e => setModuleFilter(e.target.value)}
                        className="px-2 py-1 rounded text-xs bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--separator)]"
                    >
                        <option value="">{t.all || 'All'}</option>
                        {modules.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                        {logs.length} {t.entries || 'entries'}
                    </span>
                </div>

                {/* Log List — native scroll container: avoids the percentage
                    height chain through flex + max-h that broke Radix
                    ScrollArea's viewport sizing when many logs accumulated. */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                >
                    <div className="p-2 font-mono text-xs">
                        {logs.length === 0 ? (
                            <div className="text-center py-8 text-[var(--text-tertiary)]">
                                {t.noLogs || 'No logs'}
                            </div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="flex items-start gap-2 py-1 hover:bg-[var(--bg-secondary)] rounded px-2">
                                    <span className="text-[var(--text-tertiary)] flex-shrink-0">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={`flex-shrink-0 w-8 ${levelColors[log.level]}`}>
                                        {levelLabels[log.level]}
                                    </span>
                                    <span className="text-[var(--accent)] flex-shrink-0 w-24 truncate">
                                        [{log.module}]
                                    </span>
                                    <span className="text-[var(--text-primary)] flex-1 break-all">
                                        {log.message}
                                    </span>
                                    {log.data !== undefined && log.data !== null && (
                                        <span className="text-[var(--text-tertiary)] flex-shrink-0 max-w-[200px] truncate">
                                            {typeof log.data === 'object' ? JSON.stringify(log.data) : String(log.data)}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
