import React, { useState } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useI18n } from '../../hooks/useI18n'

interface NewConnectionProps {
    onConnect: (peerId: string) => void
    loading?: boolean
    error?: string
}

export const NewConnection: React.FC<NewConnectionProps> = ({ onConnect, loading, error: connectionError }) => {
    const [peerId, setPeerId] = useState('')
    const [error, setError] = useState('')
    const { t } = useI18n()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = peerId.trim()
        if (!trimmed) {
            setError(t.pleaseEnterId)
            return
        }
        setError('')
        onConnect(trimmed)
        setPeerId('')
    }

    const displayError = error || connectionError

    return (
        <form onSubmit={handleSubmit} className="px-3 py-2 border-b border-[var(--separator)]">
            <div className="flex gap-2 items-start">
                <div className="flex-1 min-w-0">
                    <Input
                        placeholder={t.enterPeerId}
                        value={peerId}
                        onChange={(e) => {
                            setPeerId(e.target.value)
                            setError('')
                        }}
                        error={displayError}
                    />
                </div>
                <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={loading || !peerId.trim()}
                    className="h-10 px-3 flex-shrink-0"
                >
                    {loading ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    )}
                </Button>
            </div>
        </form>
    )
}
