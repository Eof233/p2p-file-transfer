import React, { useCallback, useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Progress } from '../ui/Progress'
import { formatFileSize } from '../../utils/formatters'
import { LARGE_FILE_THRESHOLD } from '../../utils/constants'

interface FileTransferDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    fileName: string
    fileSize: number
    fileType: string
    peerId: string
    direction: 'send' | 'receive'
    onAccept?: () => void
    onReject?: () => void
    onConfirm?: () => void
}

export const FileTransferDialog: React.FC<FileTransferDialogProps> = ({
    open, onOpenChange, fileName, fileSize, fileType, peerId, direction, onAccept, onReject, onConfirm
}) => {
    const isLargeFile = fileSize > LARGE_FILE_THRESHOLD

    const getFileIcon = () => {
        if (fileType.startsWith('image/')) {
            return (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
            )
        }
        return (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
            </svg>
        )
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            title={direction === 'send' ? 'Send File' : 'Receive File'}
            description={direction === 'send' ? `Send to ${peerId}` : `From ${peerId}`}
        >
            <div className="flex flex-col items-center py-4">
                <div className="w-16 h-16 flex items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] mb-4">
                    {getFileIcon()}
                </div>

                <h3 className="text-base font-medium text-[var(--text-primary)] text-center">
                    {fileName}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {formatFileSize(fileSize)}
                </p>

                {isLargeFile && direction === 'receive' && (
                    <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-[var(--warning)]/10 rounded-lg">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="text-xs text-[var(--warning)]">
                            This is a large file ({formatFileSize(fileSize)}). Accept transfer?
                        </span>
                    </div>
                )}

                <div className="flex gap-3 mt-6 w-full">
                    {direction === 'receive' ? (
                        <>
                            <Button variant="secondary" className="flex-1" onClick={onReject}>
                                Reject
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={onAccept}>
                                Accept
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={onConfirm}>
                                Send
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Dialog>
    )
}
