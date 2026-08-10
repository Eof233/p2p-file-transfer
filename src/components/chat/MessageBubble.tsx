import React from 'react'
import { Avatar } from '../ui/Avatar'
import { ChatMessage } from '../../store/chat/chatTypes'
import { formatTime } from '../../utils/formatters'

interface MessageBubbleProps {
    message: ChatMessage
    isOwn: boolean
    showAvatar?: boolean
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, showAvatar = true }) => {
    const statusIcons = {
        sent: '✓',
        delivered: '✓✓',
        read: '✓✓',
    }

    return (
        <div className={`flex gap-2 animate-message-in ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {showAvatar && !isOwn && (
                <Avatar fallback={message.senderId} size="sm" />
            )}
            <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                <div className={`px-3 py-2 rounded-2xl ${
                    isOwn
                        ? 'bg-[var(--accent)] text-white rounded-br-md'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md'
                }`}>
                    {message.type === 'image' && message.imageData && (
                        <img
                            src={message.imageData}
                            alt="Shared image"
                            className="max-w-full rounded-lg mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                        />
                    )}
                    {message.type === 'file' && (
                        <div className="flex items-center gap-2 p-2 bg-[var(--overlay)] rounded-lg mb-1">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{message.fileName}</div>
                            </div>
                        </div>
                    )}
                    {message.type === 'text' && (
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                </div>
                <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{formatTime(message.timestamp)}</span>
                    {isOwn && (
                        <span className={`text-[10px] ${message.status === 'read' ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                            {statusIcons[message.status]}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
