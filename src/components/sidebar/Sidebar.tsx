import React, { useState } from 'react'
import { ScrollArea } from '../ui/ScrollArea'
import { Button } from '../ui/Button'
import { ConnectionItem } from './ConnectionItem'
import { NewConnection } from './NewConnection'
import { useI18n } from '../../hooks/useI18n'

interface SidebarProps {
    connections: string[]
    selectedId?: string
    onSelect: (id: string) => void
    onConnect: (id: string) => void
    connectLoading?: boolean
    myId?: string
    onCopyId?: () => void
    className?: string
}

export const Sidebar: React.FC<SidebarProps> = ({
    connections, selectedId, onSelect, onConnect, connectLoading, myId, onCopyId, className = ''
}) => {
    const [showNewConnection, setShowNewConnection] = useState(false)
    const { t } = useI18n()

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
                    <NewConnection onConnect={onConnect} loading={connectLoading} />
                </div>
            )}

            {/* Connection List */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 flex flex-col gap-1">
                    {connections.length === 0 ? (
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
                                onClick={() => onSelect(id)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
