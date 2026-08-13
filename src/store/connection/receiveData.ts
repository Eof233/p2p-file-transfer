import { Dispatch } from "redux";
import { DataType, Data, PeerConnection } from "../../helpers/peer";
import { addChatMessage, setChatTyping, updateChatMessage } from "../chat/chatActions";
import { ChatMessage } from "../chat/chatTypes";
import {
    fileTransferStart,
    fileTransferProgress,
    fileTransferComplete,
    fileTransferCancel,
    fileTransferAccept,
    fileTransferError,
    filePendingAdd,
    filePendingRemove,
} from "../file/fileActions";
import {
    pendingIncomingTransfers,
    resolveAcceptWaiter,
    rejectAcceptWaiter,
    clearTransferState,
    isTransferCancelled,
    markTransferCancelled,
} from "../file/transferCoordinator";
import { encryptionManager } from "../../services/encryptionService";
import { LARGE_FILE_THRESHOLD, TYPING_TIMEOUT } from "../../utils/constants";
import { createLogger } from "../../services/logService";

const log = createLogger('ReceiveData')

/**
 * Single shared implementation of the incoming-data pipeline.
 * Previously this ~200-line handler was duplicated in connectionActions.ts
 * and connectionRequestActions.ts — every bug fix had to be applied twice.
 */

// --- Per-peer serial queue ------------------------------------------------
// PeerJS data channels are ordered, but handlers are async (decryption).
// Serialize processing per peer so the session key is always installed
// before the first encrypted message is decrypted.

const receiveQueues: Map<string, Promise<void>> = new Map()

const enqueueReceive = (peerId: string, task: () => Promise<void>): void => {
    const previous = receiveQueues.get(peerId) ?? Promise.resolve()
    const next = previous.then(task).catch((err) => {
        log.error('Error processing incoming data from peer: ' + peerId, err)
    })
    receiveQueues.set(peerId, next)
}

export const clearReceiveQueue = (peerId: string): void => {
    receiveQueues.delete(peerId)
}

// --- Typing indicator auto-clear ------------------------------------------

const typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

const handleTyping = (peerId: string, typing: boolean, dispatch: Dispatch) => {
    const existing = typingTimers.get(peerId)
    if (existing) clearTimeout(existing)
    typingTimers.delete(peerId)

    dispatch(setChatTyping(peerId, typing))

    if (typing) {
        typingTimers.set(peerId, setTimeout(() => {
            typingTimers.delete(peerId)
            dispatch(setChatTyping(peerId, false))
        }, TYPING_TIMEOUT))
    }
}

// --- Key exchange ----------------------------------------------------------

interface PeerMetadata {
    publicKey?: string
    fingerprint?: string
}

const handleKeyExchange = async (peerId: string, data: Data): Promise<void> => {
    if (!data.keyData) {
        log.warn('KEY_EXCHANGE message without keyData from peer: ' + peerId)
        return
    }
    const metadata = PeerConnection.getPeerMetadata(peerId) as PeerMetadata | undefined
    if (!metadata?.publicKey) {
        log.warn('KEY_EXCHANGE received but peer metadata missing for: ' + peerId)
        return
    }
    if (encryptionManager.hasSessionKey(peerId)) {
        log.debug('Session key already present for peer: ' + peerId)
        return
    }
    await encryptionManager.receiveSessionKey(peerId, data.keyData, metadata.publicKey)
}

// --- Chat / typing (plaintext or encrypted) ---------------------------------

const handleChatOrTyping = async (peerId: string, data: Data, dispatch: Dispatch): Promise<void> => {
    let json: Record<string, unknown>
    try {
        if (data.encrypted) {
            if (!data.iv || !data.payload) {
                log.warn('Encrypted message missing iv/payload from peer: ' + peerId)
                return
            }
            const plaintext = await encryptionManager.decryptString(peerId, { iv: data.iv, data: data.payload })
            json = JSON.parse(plaintext)
        } else {
            json = JSON.parse(data.message || '')
        }
    } catch (e) {
        log.warn('Failed to decrypt/parse message data from peer: ' + peerId, e)
        return
    }

    if (json.dataType === 'CHAT_MESSAGE') {
        const chatMessage: ChatMessage = {
            id: (json.id as string) || crypto.randomUUID(),
            senderId: (json.senderId as string) || peerId,
            content: (json.content as string) || '',
            timestamp: (json.timestamp as number) || Date.now(),
            type: (json.type as ChatMessage['type']) || 'text',
            status: 'delivered',
            fileName: json.fileName as string | undefined,
            fileSize: json.fileSize as number | undefined,
            fileType: json.fileType as string | undefined,
            imageData: json.imageData as string | undefined,
        }
        dispatch(addChatMessage(peerId, chatMessage))
        return
    }

    if (json.dataType === 'TYPING') {
        handleTyping(peerId, (json.typing as boolean) ?? false, dispatch)
    }
}

// --- File protocol ----------------------------------------------------------

const handleFileMessage = async (peerId: string, data: Data, dispatch: Dispatch): Promise<void> => {
    const { transferId, message: fileMessage } = data

    // Sender side: receiver answered our FILE_START
    if (fileMessage === 'FILE_ACCEPT' && transferId) {
        if (isTransferCancelled(transferId)) {
            log.debug('Ignoring late FILE_ACCEPT for cancelled transfer: ' + transferId)
            return
        }
        log.info('File accepted by peer: ' + peerId + ', transfer: ' + transferId)
        resolveAcceptWaiter(transferId)
        dispatch(fileTransferAccept(transferId))
        return
    }

    if (fileMessage === 'FILE_REJECT' && transferId) {
        log.info('File rejected by peer: ' + peerId + ', transfer: ' + transferId)
        rejectAcceptWaiter(transferId, 'Transfer rejected by peer')
        if (isTransferCancelled(transferId)) {
            dispatch(fileTransferCancel(transferId))
        } else {
            dispatch(fileTransferError(transferId, 'Transfer rejected by peer'))
        }
        clearTransferState(transferId)
        return
    }

    if (fileMessage === 'FILE_CANCEL' && transferId) {
        log.info('Transfer cancelled by peer: ' + peerId + ', transfer: ' + transferId)
        // Mark before cleaning so a running send loop stops at its next
        // chunk boundary (the loop's own error path does the full cleanup).
        markTransferCancelled(transferId)
        pendingIncomingTransfers.delete(transferId)
        dispatch(fileTransferCancel(transferId))
        dispatch(filePendingRemove(transferId))
        return
    }

    // Receiver side: file lifecycle
    if (fileMessage === 'FILE_START' && transferId) {
        log.info('File transfer started from peer: ' + peerId + ', transfer: ' + transferId + ', file: ' + data.fileName)

        const chatType: 'file' | 'image' = data.messageType === 'image' ? 'image' : 'file'
        const metadata = {
            fileName: data.fileName || 'unknown',
            fileSize: data.fileSize || 0,
            fileType: data.fileType || 'application/octet-stream',
            totalChunks: 0,
            chatType,
        }

        // Duplicate FILE_START for an existing transfer: ignore
        if (pendingIncomingTransfers.has(transferId)) {
            log.debug('Duplicate FILE_START ignored for transfer: ' + transferId)
            return
        }

        pendingIncomingTransfers.set(transferId, {
            chunks: new Map(),
            metadata,
            peerId,
            accepted: false,
        })

        const isLarge = metadata.fileSize > LARGE_FILE_THRESHOLD

        if (isLarge) {
            // Requires explicit user confirmation
            dispatch(filePendingAdd(transferId, metadata.fileName, metadata.fileSize, metadata.fileType, peerId))
            return
        }

        // Small files are accepted automatically
        const entry = pendingIncomingTransfers.get(transferId)!
        entry.accepted = true
        dispatch(fileTransferStart({
            id: transferId,
            fileName: metadata.fileName,
            fileSize: metadata.fileSize,
            fileType: metadata.fileType,
            peerId,
            direction: 'receive',
            progress: 0,
            status: 'transferring',
        }))
        dispatch(addChatMessage(peerId, {
            id: transferId,
            senderId: peerId,
            content: metadata.fileName,
            timestamp: Date.now(),
            type: chatType,
            status: 'delivered',
            fileName: metadata.fileName,
            fileSize: metadata.fileSize,
            fileType: metadata.fileType,
            transferId,
        } as ChatMessage))
        PeerConnection.sendConnection(peerId, { dataType: DataType.FILE, message: 'FILE_ACCEPT', transferId })
            .catch((err) => log.error('Failed to send FILE_ACCEPT', err))
        return
    }

    if (fileMessage === 'FILE_CHUNK' && transferId) {
        const { chunkIndex, totalChunks } = data

        if (chunkIndex === undefined || !totalChunks) {
            log.warn('Invalid FILE_CHUNK received from peer: ' + peerId)
            return
        }

        const entry = pendingIncomingTransfers.get(transferId)
        if (!entry || !entry.accepted) {
            log.warn('FILE_CHUNK received for unknown/unaccepted transfer: ' + transferId)
            return
        }

        try {
            let chunkBlob: Blob
            if (data.encrypted) {
                if (!data.iv || !data.payload) {
                    log.warn('Encrypted FILE_CHUNK missing iv/payload from peer: ' + peerId)
                    return
                }
                const plainBytes = await encryptionManager.decryptBytes(peerId, { iv: data.iv, data: data.payload })
                chunkBlob = new Blob([plainBytes], { type: entry.metadata.fileType })
            } else if (data.file instanceof Blob) {
                chunkBlob = data.file
            } else if (data.file) {
                chunkBlob = new Blob([data.file as ArrayBuffer], { type: entry.metadata.fileType })
            } else {
                log.warn('FILE_CHUNK without payload from peer: ' + peerId)
                return
            }

            entry.metadata.totalChunks = totalChunks
            entry.chunks.set(chunkIndex, chunkBlob)

            const progress = Math.round((entry.chunks.size / totalChunks) * 100)
            dispatch(fileTransferProgress(transferId, progress))
        } catch (err) {
            log.error('Failed to process FILE_CHUNK', err)
            dispatch(fileTransferError(transferId, 'Failed to decrypt/process chunk'))
        }
        return
    }

    if (fileMessage === 'FILE_END' && transferId) {
        const entry = pendingIncomingTransfers.get(transferId)

        if (!entry || !entry.accepted || entry.chunks.size < entry.metadata.totalChunks) {
            log.warn('FILE_END received but transfer incomplete: ' + transferId)
            if (entry) {
                dispatch(fileTransferError(transferId, 'Incomplete transfer'))
                clearTransferState(transferId)
            }
            return
        }

        log.info('File transfer complete, reassembling: ' + transferId)

        if (data.fileName) entry.metadata.fileName = data.fileName
        if (data.fileSize) entry.metadata.fileSize = data.fileSize
        if (data.fileType) entry.metadata.fileType = data.fileType

        const sortedChunks: Blob[] = []
        for (let i = 0; i < entry.metadata.totalChunks; i++) {
            const chunk = entry.chunks.get(i)
            if (!chunk) {
                log.error('Missing chunk ' + i + ' for transfer: ' + transferId)
                dispatch(fileTransferError(transferId, 'Incomplete transfer: missing chunk ' + i))
                clearTransferState(transferId)
                return
            }
            sortedChunks.push(chunk)
        }
        const blob = new Blob(sortedChunks, { type: entry.metadata.fileType })

        dispatch(fileTransferComplete(transferId, blob))

        // Inline images: hand the chat message a local object URL
        if (entry.metadata.chatType === 'image') {
            const url = URL.createObjectURL(blob)
            dispatch(updateChatMessage(peerId, transferId, { imageData: url }))
        }

        clearTransferState(transferId)
        return
    }

    log.warn('Unknown FILE message type from peer: ' + peerId + ', message: ' + fileMessage)
}

// --- Legacy typing ----------------------------------------------------------

const handleLegacyTyping = (peerId: string, dispatch: Dispatch) => {
    handleTyping(peerId, true, dispatch)
}

// --- Entry point ------------------------------------------------------------

const processReceivedData = async (peerId: string, data: Data, dispatch: Dispatch): Promise<void> => {
    log.debug('Handling received data from peer: ' + peerId + ', type: ' + data.dataType)

    switch (data.dataType) {
        case DataType.KEY_EXCHANGE:
            await handleKeyExchange(peerId, data)
            return
        case DataType.OTHER:
            await handleChatOrTyping(peerId, data, dispatch)
            return
        case DataType.FILE:
            await handleFileMessage(peerId, data, dispatch)
            return
        case DataType.TYPING:
            handleLegacyTyping(peerId, dispatch)
            return
        default:
            log.debug('Ignoring unhandled data type: ' + data.dataType)
    }
}

export const handleReceivedData = (peerId: string, data: Data, dispatch: Dispatch): void => {
    enqueueReceive(peerId, () => processReceivedData(peerId, data, dispatch))
}
