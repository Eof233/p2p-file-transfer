import React, { useState, useRef, useCallback } from 'react'
import { Button } from '../ui/Button'
import { useI18n } from '../../hooks/useI18n'

interface MessageInputProps {
    onSendMessage: (content: string) => void
    onSendFile?: (file: File) => void
    onSendImage?: (file: File) => void
    onTyping?: (isTyping: boolean) => void
    disabled?: boolean
}

export const MessageInput: React.FC<MessageInputProps> = ({
    onSendMessage, onSendFile, onSendImage, onTyping, disabled
}) => {
    const [message, setMessage] = useState('')
    const [pasteFeedback, setPasteFeedback] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
    const { t } = useI18n()

    const handleSend = useCallback(() => {
        const trimmed = message.trim()
        if (!trimmed) return
        onSendMessage(trimmed)
        setMessage('')
        onTyping?.(false)
    }, [message, onSendMessage, onTyping])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }, [handleSend])

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value)
        onTyping?.(true)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => onTyping?.(false), 3000)
    }, [onTyping])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.type.startsWith('image/')) {
                onSendImage?.(file)
            } else {
                onSendFile?.(file)
            }
            e.target.value = ''
        }
    }, [onSendFile, onSendImage])

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (file && onSendImage) {
                    // Create a proper File with name
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
                    const imageFile = new File([file], `screenshot-${timestamp}.png`, { type: file.type })
                    onSendImage(imageFile)
                    setPasteFeedback(true)
                    setTimeout(() => setPasteFeedback(false), 1500)
                }
                break
            }
        }
    }, [onSendImage])

    return (
        <div className="flex items-end gap-2 p-4 bg-[var(--bg-primary)] border-t border-[var(--separator)]">
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
            />
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
            />

            <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                title={t.sendFile}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
            </Button>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={disabled}
                title={`${t.sendImage}\n${t.pasteImage}`}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
            </Button>

            <div className="flex-1 relative">
                <textarea
                    value={message}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={t.typeMessage}
                    disabled={disabled}
                    rows={1}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--separator)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none max-h-32"
                    style={{ minHeight: '40px' }}
                />
                {pasteFeedback && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-[var(--success)] text-white text-sm font-medium shadow-lg animate-fade-in-out whitespace-nowrap">
                        {t.imagePasted}
                    </div>
                )}
            </div>

            <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={disabled || !message.trim()}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
            </Button>
        </div>
    )
}
