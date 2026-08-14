import React, { useState } from 'react'
import { ScrollArea } from '../ui/ScrollArea'
import { Button } from '../ui/Button'
import { ConnectionItem } from './ConnectionItem'
import { NewConnection } from './NewConnection'
import { useI18n } from '../../hooks/useI18n'
import { useAppSelector } from '../../store/hooks'

interface SidebarProps {
    connections: string[]
    history?: string[]
    selectedId?: string
    onSelect: (id: string) => void
    onConnect: (id: string) => void
    connectLoading?: boolean
    connectError?: string
    myId?: string
    onCopyId?: () => void
    className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({
    connections, history = [], selectedId, onSelect, onConnect, connectLoading, connectError, myId, onCopyId, className = ''
}) => {
    const [showNewConnection, setShowNewConnection] = useState(false)
    const { t } = useI18n()
    // Peers currently attempting an automatic data-channel reconnect.
    const reconnectingIds = useAppSelector((state) => state.connection.reconnecting)

    const recentPeers = history.filter(id => !connections.includes(id)).slice(0, 5)

    return (
        <div className={`flex flex-col h-full bg-[var(--bg-primary)] border-r border-[var(--separator)] overflow-hidden ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--separator)] flex-shrink-0">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t.chats}</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewConnection(!showNewConnection)}
                    className="h-8 w-8 p-0 flex items-center justify-center"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </Button>
            </div>

            {/* My ID */}
            {myId && (
                <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] flex-shrink-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">ID:</span>
                        <code className="text-xs font-mono text-[var(--text-secondary)] truncate">{myId}</code>
                    </div>
                    <button
                        onClick={onCopyId}
                        className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] flex-shrink-0 ml-2"
                        title={t.copyId}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                    </button>
                </div>
            )}

            {/* New Connection Form */}
            {showNewConnection && (
                <div className="flex-shrink-0">
                    <NewConnection onConnect={onConnect} loading={connectLoading} error={connectError} />
                </div>
            )}

            {/* Connection List */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 flex flex-col gap-1">
                    {connections.length === 0 && recentPeers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <svg className="mb-3 text-[var(--text-tertiary)]" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <p className="text-sm text-[var(--text-tertiary)]">{t.noConnections}</p>
                            <p className="text-xs text-[var(--text-tertiary)] mt-1">{t.noConnectionsHint}</p>
                        </div>
                    ) : (
                        connections.map(id => (
                            <ConnectionItem
                                key={id}
                                peerId={id}
                                isActive={id === selectedId}
                                reconnecting={reconnectingIds.includes(id)}
                                onClick={() => onSelect(id)}
                            />
                        ))
                    )}

                    {/* Recent connections */}
                    {recentPeers.length > 0 && (
                        <>
                            <div className="px-2 pt-3 pb-1 text-xs font-medium text-[var(--text-tertiary)]">
                                {t.recent}
                            </div>
                            {recentPeers.map(id => (
                                <button
                                    key={id}
                                    onClick={() => onConnect(id)}
                                    disabled={connectLoading}
                                    className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-left hover:bg-[var(--bg-secondary)] transition-colors group"
                                    title={`${t.connect} ${id}`}
                                >
                                    <code className="text-xs font-mono text-[var(--text-secondary)] truncate">{id}</code>
                                    <svg
                                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[var(--accent)]"
                                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    >
                                        <path d="M5 12h14" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
