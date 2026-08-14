import React from 'react'
import { Avatar } from '../ui/Avatar'
import { ChatMessage } from '../../store/chat/chatTypes'
import { FileTransfer } from '../../store/file/fileTypes'
import { formatTime } from '../../utils/formatters'
import { useAppSelector } from '../../store/hooks'
import { useFileTransfer } from '../../hooks/useFileTransfer'
import { useI18n } from '../../hooks/useI18n'
import { FileMessage } from './FileMessage'
import { MarkdownContent } from './MarkdownContent'

interface MessageBubbleProps {
    message: ChatMessage
    isOwn: boolean
    showAvatar?: boolean
    onImageClick?: (imageData: string) => void
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, showAvatar = true, onImageClick }) => {
    const { cancelTransfer } = useFileTransfer()
    const { t } = useI18n()

    // Delivery marks are sender-side only; received messages never show them.
    const statusIcons: Record<'sent' | 'delivered' | 'read', string> = {
        sent: '✓',
        delivered: '✓✓',
        read: '✓✓',
    }

    // Look up file transfer progress if this message has a transferId
    const transfer = useAppSelector((state) =>
        message.transferId
            ? (state.file.transfers as Record<string, FileTransfer> | undefined)?.[message.transferId]
            : undefined
    )

    const showTransferCard =
        message.type === 'file' ||
        (message.type === 'image' && !message.imageData)

    return (
        <div className={`flex gap-2 animate-message-in ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {showAvatar && !isOwn && (
                <Avatar fallback={message.senderId} size="sm" />
            )}
            <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                <div className={`px-3 py-2 rounded-2xl ${
                    isOwn
                        ? 'bg-[var(--accent)] text-white rounded-br-md'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md'
                }`}>
                    {message.type === 'image' && message.imageData && (
                        <div
                            className="cursor-pointer group relative"
                            onClick={() => onImageClick?.(message.imageData!)}
                        >
                            <img
                                src={message.imageData}
                                alt={t.sharedImage}
                                className="max-w-[280px] max-h-[200px] rounded-lg object-cover transition-opacity group-hover:opacity-90"
                                style={{ width: 'auto', height: 'auto' }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                </svg>
                            </div>
                        </div>
                    )}
                    {showTransferCard && (
                        <FileMessage
                            fileName={message.fileName || (message.type === 'image' ? t.image : t.file)}
                            fileSize={message.fileSize || 0}
                            fileType={message.fileType || 'application/octet-stream'}
                            progress={transfer?.progress}
                            speed={transfer?.speed}
                            isOwn={isOwn}
                            status={transfer?.status}
                            error={transfer?.error}
                            blob={transfer?.blob}
                            onCancel={message.transferId ? () => cancelTransfer(message.transferId!) : undefined}
                        />
                    )}
                    {message.type === 'text' && (
                        <MarkdownContent content={message.content} />
                    )}
                </div>
                <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{formatTime(message.timestamp)}</span>
                    {isOwn && message.status && (
                        <span className={`text-[10px] ${message.status === 'read' ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                            {statusIcons[message.status]}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
