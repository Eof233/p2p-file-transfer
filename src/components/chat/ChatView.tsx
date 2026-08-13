import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { ScrollArea } from '../ui/ScrollArea'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { ImagePreviewModal } from './ImagePreviewModal'
import { KeyVerificationDialog } from '../security/KeyVerificationDialog'
import { ConnectionInfo } from './ConnectionInfo'
import { FileTransferDialog } from '../file/FileTransferDialog'
import { useChat } from '../../hooks/useChat'
import { useFileTransfer } from '../../hooks/useFileTransfer'
import { useEncryption } from '../../hooks/useEncryption'
import { useI18n } from '../../hooks/useI18n'
import { ImageService } from '../../services/imageService'

interface ChatViewProps {
    peerId: string
    peerName?: string
}

export const ChatView: React.FC<ChatViewProps> = ({ peerId, peerName }) => {
    const { messages, typing, myId, sendMessage, setTyping, clearMessages } = useChat(peerId)
    const { sendFile, acceptFile, rejectFile, pendingFiles } = useFileTransfer()
    const {
        fingerprint,
        hasSessionKey,
        getRemoteFingerprint,
        markPeerVerified,
        isPeerVerified,
    } = useEncryption()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const { t } = useI18n()
    const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [dragActive, setDragActive] = useState(false)
    const dragDepthRef = useRef(0)

    // Incoming files from this peer awaiting acceptance
    const incomingPendingFile = useMemo(
        () => pendingFiles.find(f => f.peerId === peerId) || null,
        [pendingFiles, peerId],
    )

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSendMessage = useCallback((content: string) => {
        sendMessage(content, 'text')
    }, [sendMessage])

    const handleSendFile = useCallback((file: File) => {
        sendFile(file).catch(() => {})
    }, [sendFile])

    const handleSendImage = useCallback(async (file: File) => {
        // Compress before sending, then transfer via the chunked file protocol
        // (single-message base64 breaks the data channel size limit).
        try {
            const compressed = await ImageService.compressImage(file)
            const preview = await ImageService.fileToBase64(compressed)
            await sendFile(compressed, { chatType: 'image', previewData: preview })
        } catch (err) {
            // Fall back to the raw file if compression fails
            const preview = await ImageService.fileToBase64(file)
            await sendFile(file, { chatType: 'image', previewData: preview })
        }
    }, [sendFile])

    const handleTyping = useCallback((isTyping: boolean) => {
        setTyping(isTyping)
    }, [setTyping])

    // --- Drag & drop file sending ---
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) {
            dragDepthRef.current++
            setDragActive(true)
        }
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
        if (dragDepthRef.current === 0) setDragActive(false)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        dragDepthRef.current = 0
        setDragActive(false)

        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                handleSendImage(file)
            } else {
                handleSendFile(file)
            }
        }
    }, [handleSendFile, handleSendImage])

    // Encryption state for this peer
    const isEncrypted = hasSessionKey(peerId)
    const remoteFingerprint = getRemoteFingerprint(peerId)
    const isVerified = isPeerVerified(peerId)
    const canVerify = isEncrypted && !!remoteFingerprint && !!fingerprint

    if (!peerId) {
        return (
            <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)]">
                <div className="text-center">
                    <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <p className="text-lg font-medium">{t.selectConnection}</p>
                    <p className="text-sm mt-1">{t.selectConnectionHint}</p>
                </div>
            </div>
        )
    }

    return (
        <div
            className="flex flex-col h-full relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag & drop overlay */}
            {dragActive && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--accent)]/10 border-2 border-dashed border-[var(--accent)] rounded-xl m-2 pointer-events-none animate-fade-in">
                    <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-[var(--bg-elevated)] shadow-lg">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{t.dropFiles}</span>
                    </div>
                </div>
            )}

            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--separator)] bg-[var(--bg-primary)]">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                    <span className="font-medium text-[var(--text-primary)]">{peerName || peerId}</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Security indicator */}
                    {canVerify && (
                        <button
                            onClick={() => setVerifyDialogOpen(true)}
                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                            title={isVerified ? t.keysVerified : t.verifyKeys}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                strokeWidth="2"
                                stroke={isVerified ? 'var(--success)' : 'var(--text-tertiary)'}
                            >
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={clearMessages}
                        className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]"
                        title={t.clearChat}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Connection Info */}
            <div className="px-4 py-1.5 border-b border-[var(--separator)]">
                <ConnectionInfo peerId={peerId} />
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-3">
                    {messages.map((msg, i) => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOwn={msg.senderId === myId}
                            showAvatar={i === 0 || messages[i - 1].senderId !== msg.senderId}
                            onImageClick={setPreviewImage}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Typing Indicator */}
            <TypingIndicator isTyping={typing} peerName={peerName} />

            {/* Input */}
            <MessageInput
                onSendMessage={handleSendMessage}
                onSendFile={handleSendFile}
                onSendImage={handleSendImage}
                onTyping={handleTyping}
            />

            {/* Incoming file confirmation dialog */}
            {incomingPendingFile && (
                <FileTransferDialog
                    open={true}
                    onOpenChange={() => {}}
                    fileName={incomingPendingFile.fileName}
                    fileSize={incomingPendingFile.fileSize}
                    fileType={incomingPendingFile.fileType}
                    peerId={peerId}
                    direction="receive"
                    onAccept={() => acceptFile(incomingPendingFile.id)}
                    onReject={() => rejectFile(incomingPendingFile.id)}
                />
            )}

            {/* Key Verification Dialog */}
            {fingerprint && remoteFingerprint && (
                <KeyVerificationDialog
                    open={verifyDialogOpen}
                    onOpenChange={setVerifyDialogOpen}
                    peerId={peerId}
                    localFingerprint={fingerprint}
                    remoteFingerprint={remoteFingerprint}
                    onVerified={() => markPeerVerified(peerId)}
                />
            )}

            {/* Image Preview Modal */}
            <ImagePreviewModal
                open={!!previewImage}
                onClose={() => setPreviewImage(null)}
                imageData={previewImage || ''}
            />
        </div>
    )
}
