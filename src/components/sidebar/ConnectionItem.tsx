import React from 'react'
import { Avatar } from '../ui/Avatar'
import { useI18n } from '../../hooks/useI18n'

interface ConnectionItemProps {
    peerId: string
    isActive: boolean
    isOnline?: boolean
    lastMessage?: string
    unreadCount?: number
    reconnecting?: boolean
    onClick: () => void
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
    peerId, isActive, isOnline = true, lastMessage, unreadCount, reconnecting = false, onClick
}) => {
    const { t } = useI18n()
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
                status={isOnline && !reconnecting ? 'online' : 'offline'}
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
                {reconnecting ? (
                    <p className={`text-xs truncate mt-0.5 ${
                        isActive ? 'text-white/70' : 'text-[var(--warning)]'
                    }`}>
                        {t.reconnecting}
                    </p>
                ) : lastMessage ? (
                    <p className={`text-xs truncate mt-0.5 ${
                        isActive ? 'text-white/70' : 'text-[var(--text-tertiary)]'
                    }`}>
                        {lastMessage}
                    </p>
                ) : null}
            </div>
        </button>
    )
}
