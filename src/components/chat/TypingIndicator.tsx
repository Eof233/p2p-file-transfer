import React from 'react'
import { useI18n } from '../../hooks/useI18n'

interface TypingIndicatorProps {
    isTyping: boolean
    peerName?: string
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping, peerName }) => {
    const { t } = useI18n()

    if (!isTyping) return null

    return (
        <div className="flex items-center gap-2 px-4 py-2 animate-fade-in">
            <div className="flex gap-1">
                <span className="typing-dot w-2 h-2 bg-[var(--text-tertiary)] rounded-full" />
                <span className="typing-dot w-2 h-2 bg-[var(--text-tertiary)] rounded-full" />
                <span className="typing-dot w-2 h-2 bg-[var(--text-tertiary)] rounded-full" />
            </div>
            <span className="text-xs text-[var(--text-tertiary)]">
                {peerName || 'Peer'} {t.peerIsTyping}
            </span>
        </div>
    )
}
