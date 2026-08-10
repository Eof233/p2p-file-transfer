import React from 'react'
import { Progress } from '../ui/Progress'
import { FileTransfer } from '../../store/file/fileTypes'
import { formatFileSize, formatSpeed, formatDuration } from '../../utils/formatters'

interface TransferProgressProps {
    transfer: FileTransfer
    onCancel?: () => void
}

export const TransferProgress: React.FC<TransferProgressProps> = ({ transfer, onCancel }) => {
    const statusColors = {
        pending: 'text-[var(--text-tertiary)]',
        transferring: 'text-[var(--accent)]',
        completed: 'text-[var(--success)]',
        cancelled: 'text-[var(--warning)]',
        error: 'text-[var(--error)]',
    }

    const statusLabels = {
        pending: 'Pending',
        transferring: 'Transferring',
        completed: 'Completed',
        cancelled: 'Cancelled',
        error: 'Error',
    }

    const isTransferring = transfer.status === 'transferring'
    const isPending = transfer.status === 'pending'

    return (
        <div className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg animate-fade-in">
            {/* File Icon */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--bg-tertiary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {transfer.fileName}
                    </span>
                    <span className={`text-xs font-medium ${statusColors[transfer.status]}`}>
                        {statusLabels[transfer.status]}
                    </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[var(--text-tertiary)]">
                        {formatFileSize(transfer.fileSize)}
                    </span>
                    {transfer.speed && isTransferring && (
                        <>
                            <span className="text-[var(--text-tertiary)]">·</span>
                            <span className="text-xs text-[var(--text-tertiary)]">
                                {formatSpeed(transfer.speed)}
                            </span>
                        </>
                    )}
                </div>

                {(isTransferring || isPending) && (
                    <Progress value={transfer.progress} className="mt-2" showLabel />
                )}

                {transfer.error && (
                    <p className="text-xs text-[var(--error)] mt-1">{transfer.error}</p>
                )}
            </div>

            {/* Cancel Button */}
            {(isTransferring || isPending) && onCancel && (
                <button
                    onClick={onCancel}
                    className="flex-shrink-0 p-1.5 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                    title="Cancel transfer"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    )
}
