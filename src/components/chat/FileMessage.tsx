import React from 'react'
import { Progress } from '../ui/Progress'
import { formatFileSize, formatSpeed } from '../../utils/formatters'
import { useI18n } from '../../hooks/useI18n'

interface FileMessageProps {
    fileName: string
    fileSize: number
    fileType: string
    progress?: number  // 0-100, undefined if complete
    speed?: number  // bytes per second
    isOwn: boolean
    status?: 'pending' | 'transferring' | 'completed' | 'cancelled' | 'error'
    error?: string
    blob?: Blob  // received file blob for download
    onCancel?: () => void
}

const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
            </svg>
        )
    }
    if (fileType.startsWith('video/')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
        )
    }
    if (fileType.startsWith('audio/')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
            </svg>
        )
    }
    if (fileType === 'application/pdf') {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        )
    }
    // Generic file icon
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    )
}

export const FileMessage: React.FC<FileMessageProps> = ({
    fileName, fileSize, fileType, progress, speed, isOwn, status, error, blob, onCancel
}) => {
    const { t } = useI18n()
    const isTransferring = status === 'transferring'
    const isPending = status === 'pending'
    const isComplete = status === 'completed'
    const isCancelled = status === 'cancelled'
    const isError = status === 'error'

    const handleDownload = () => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    return (
        <div className="flex items-center gap-3 p-2 min-w-[240px]">
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--overlay)]">
                {getFileIcon(fileType)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{fileName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs opacity-70">{formatFileSize(fileSize)}</span>
                    {isTransferring && speed !== undefined && speed > 0 && (
                        <>
                            <span className="text-xs opacity-50">·</span>
                            <span className="text-xs opacity-70">{formatSpeed(speed)}</span>
                        </>
                    )}
                </div>
                {isTransferring && progress !== undefined && (
                    <Progress value={progress} className="mt-1.5" showLabel />
                )}
                {isPending && (
                    <div className="flex items-center gap-1 mt-1 opacity-60">
                        <span className="text-xs">{t.pending}</span>
                    </div>
                )}
                {isComplete && (
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-[var(--success)]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span className="text-xs">{isOwn ? t.fileSent : t.fileReceived}</span>
                        </div>
                        {!isOwn && blob && (
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                {t.download}
                            </button>
                        )}
                    </div>
                )}
                {isCancelled && (
                    <div className="flex items-center gap-1 mt-1 text-[var(--warning)]">
                        <span className="text-xs">{t.cancelled}</span>
                    </div>
                )}
                {isError && (
                    <div className="flex items-center gap-1 mt-1 text-[var(--error)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        <span className="text-xs">{error || t.error}</span>
                    </div>
                )}
            </div>
            {(isTransferring || isPending) && onCancel && (
                <button
                    onClick={onCancel}
                    className="flex-shrink-0 p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                    title={t.cancel}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    )
}
