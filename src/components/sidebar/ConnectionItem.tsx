import React from 'react'
import { Avatar } from '../ui/Avatar'

interface ConnectionItemProps {
    peerId: string
    isActive: boolean
    isOnline?: boolean
    lastMessage?: string
    unreadCount?: number
    onClick: () => void
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
    peerId, isActive, isOnline = true, lastMessage, unreadCount, onClick
}) => {
    return (
        <button
            onClick={onClick}
            className={`sidebar-item w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'hover:bg-[var(--bg-secondary)]'
            }`}
        >
            <Avatar
                fallback={peerId}
                size="md"
                status={isOnline ? 'online' : 'offline'}
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className={`font-medium text-sm truncate ${
                        isActive ? 'text-white' : 'text-[var(--text-primary)]'
                    }`}>
                        {peerId.substring(0, 12)}...
                    </span>
                    {unreadCount && unreadCount > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 text-xs font-medium bg-[var(--error)] text-white rounded-full">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
                {lastMessage && (
                    <p className={`text-xs truncate mt-0.5 ${
                        isActive ? 'text-white/70' : 'text-[var(--text-tertiary)]'
                    }`}>
                        {lastMessage}
                    </p>
                )}
            </div>
        </button>
    )
}
