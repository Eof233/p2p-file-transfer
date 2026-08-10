import React, { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { formatFileSize } from '../../utils/formatters'

interface FilePreviewProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    fileName: string
    fileType: string
    fileUrl?: string
    onDownload?: () => void
}

export const FilePreview: React.FC<FilePreviewProps> = ({
    open, onOpenChange, fileName, fileType, fileUrl, onDownload
}) => {
    const renderPreview = () => {
        if (!fileUrl) {
            return (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p className="mt-2">Preview not available</p>
                </div>
            )
        }

        if (fileType.startsWith('image/')) {
            return (
                <div className="flex items-center justify-center p-4">
                    <img
                        src={fileUrl}
                        alt={fileName}
                        className="max-w-full max-h-[60vh] object-contain rounded-lg"
                    />
                </div>
            )
        }

        if (fileType.startsWith('video/')) {
            return (
                <video
                    src={fileUrl}
                    controls
                    className="w-full max-h-[60vh] rounded-lg"
                />
            )
        }

        if (fileType.startsWith('audio/')) {
            return (
                <div className="flex items-center justify-center py-8">
                    <audio src={fileUrl} controls />
                </div>
            )
        }

        if (fileType === 'application/pdf') {
            return (
                <iframe
                    src={fileUrl}
                    className="w-full h-[60vh] rounded-lg"
                    title={fileName}
                />
            )
        }

        return (
            <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="mt-2">Preview not available for this file type</p>
            </div>
        )
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            title={fileName}
        >
            <div className="flex flex-col">
                {renderPreview()}

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--separator)]">
                    <span className="text-sm text-[var(--text-secondary)]">
                        {fileType}
                    </span>
                    {onDownload && (
                        <Button variant="primary" size="sm" onClick={onDownload}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                        </Button>
                    )}
                </div>
            </div>
        </Dialog>
    )
}
