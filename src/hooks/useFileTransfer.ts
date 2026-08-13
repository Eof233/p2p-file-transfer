import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { FileTransfer } from '../store/file/fileTypes'
import {
    fileTransferStart,
    fileTransferProgress,
    fileTransferComplete,
    fileTransferError,
    fileTransferCancel,
    filePendingRemove,
    acceptIncomingFile,
    rejectIncomingFile,
} from '../store/file/fileActions'
import {
    markTransferCancelled,
    isTransferCancelled,
    waitForAcceptance,
    waitForEndAnswer,
    clearTransferState,
} from '../store/file/transferCoordinator'
import { addChatMessage } from '../store/chat/chatActions'
import { ChatMessage } from '../store/chat/chatTypes'
import { DataType, PeerConnection } from '../helpers/peer'
import { FileService } from '../services/fileService'
import { encryptionManager } from '../services/encryptionService'
import { validateFile } from '../utils/validators'
import { formatFileSize } from '../utils/formatters'
import { createLogger } from '../services/logService'

const log = createLogger('useFileTransfer')

const CHUNK_SIZE = 16 * 1024 // 16KB per chunk
const ACCEPT_TIMEOUT = 120 * 1000 // wait up to 2 min for receiver acceptance
const END_ANSWER_TIMEOUT = 60 * 1000 // wait up to 1 min for FILE_COMPLETE/MISSING
const MAX_RETRANSMIT_ROUNDS = 5 // how many times the receiver may ask for chunks
const MAX_BUFFERED_BYTES = 1024 * 1024 // pause sending while the channel buffers >1MB

interface SendFileOptions {
    chatType?: 'file' | 'image'
    previewData?: string // local data URL shown on the sender side for images
}

/** Wait until the data channel drains below the buffering threshold. */
const waitForBuffer = async (peerId: string): Promise<void> => {
    while (true) {
        const conn = PeerConnection.getConnectionMap().get(peerId)
        const dataChannel = conn?.dataChannel
        if (!conn || !conn.open || !dataChannel) return
        const buffered = typeof dataChannel.bufferedAmount === 'number' ? dataChannel.bufferedAmount : 0
        if (buffered <= MAX_BUFFERED_BYTES) return
        await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
}

export const useFileTransfer = () => {
    const dispatch = useAppDispatch()

    const transfers = useAppSelector(
        (state) => state.file.transfers,
    )

    const pendingFiles = useAppSelector(
        (state) => state.file.pendingFiles,
    )

    const encryptionEnabled = useAppSelector((state) => state.settings.encryptionEnabled)
    const maxFileSize = useAppSelector((state) => state.settings.maxFileSize)
    const selectedPeerId = useAppSelector((state) => state.connection.selectedId)
    const myId = useAppSelector((state) => state.peer.id)

    const sendFile = useCallback(
        async (file: File, options?: SendFileOptions) => {
            if (!selectedPeerId) {
                throw new Error('No peer selected')
            }

            // Enforce the configured size limit before doing any work
            if (maxFileSize > 0 && !validateFile(file, maxFileSize).valid) {
                throw new Error(`File exceeds the ${formatFileSize(maxFileSize)} limit`)
            }

            log.info('Sending file: ' + file.name + ', size: ' + file.size + ' bytes')

            const transferId = crypto.randomUUID()
            const chatType = options?.chatType ?? 'file'
            const peerId = selectedPeerId

            // Create transfer record with 'pending' status (waiting for acceptance)
            const transfer: FileTransfer = {
                id: transferId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                peerId,
                direction: 'send',
                progress: 0,
                status: 'pending',
            }
            dispatch(fileTransferStart(transfer))

            // Add a chat message so the file shows in the chat immediately
            const chatMessage: ChatMessage = {
                id: transferId,
                senderId: myId || '',
                content: chatType === 'image' ? '' : file.name,
                timestamp: Date.now(),
                type: chatType,
                status: 'sent',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                transferId,
                imageData: options?.previewData,
            }
            dispatch(addChatMessage(peerId, chatMessage))

            // Encrypt chunks when a session key exists and encryption is enabled
            const useEncryption = encryptionEnabled && encryptionManager.hasSessionKey(peerId)

            try {
                const chunks = await FileService.chunkFile(file, transferId, CHUNK_SIZE)

                // 1. Send FILE_START with metadata so the receiver can show the
                //    file immediately and decide whether to accept it. When a
                //    session key exists the metadata is encrypted too.
                if (useEncryption) {
                    const encryptedMeta = await encryptionManager.encryptString(peerId, JSON.stringify({
                        transferId,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        messageType: chatType,
                    }))
                    await PeerConnection.sendConnection(peerId, {
                        dataType: DataType.FILE,
                        message: 'FILE_START',
                        transferId,
                        encrypted: true,
                        iv: encryptedMeta.iv,
                        payload: encryptedMeta.data,
                    })
                } else {
                    await PeerConnection.sendConnection(peerId, {
                        dataType: DataType.FILE,
                        message: 'FILE_START',
                        transferId,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        messageType: chatType,
                    })
                }

                // 2. Wait for the receiver's FILE_ACCEPT (rejects on FILE_REJECT/timeout)
                await waitForAcceptance(transferId, ACCEPT_TIMEOUT)
                if (isTransferCancelled(transferId)) {
                    throw new Error('Transfer cancelled')
                }

                // 3. Send chunks, then hand over to the retransmission loop:
                //    FILE_END → receiver answers FILE_COMPLETE or FILE_MISSING.
                const startTime = Date.now()
                let bytesSent = 0
                const sentIndexes = new Set<number>()

                const sendChunk = async (index: number) => {
                    if (isTransferCancelled(transferId)) {
                        throw new Error('Transfer cancelled')
                    }

                    const chunk = chunks[index]
                    let chunkMessage: Parameters<typeof PeerConnection.sendConnection>[1]
                    if (useEncryption) {
                        const encrypted = await encryptionManager.encryptBytes(peerId, chunk.data)
                        chunkMessage = {
                            dataType: DataType.FILE,
                            message: 'FILE_CHUNK',
                            transferId,
                            chunkIndex: index,
                            totalChunks: chunks.length,
                            encrypted: true,
                            iv: encrypted.iv,
                            payload: encrypted.data,
                        }
                    } else {
                        const blob = new Blob([chunk.data], { type: file.type })
                        chunkMessage = {
                            dataType: DataType.FILE,
                            message: 'FILE_CHUNK',
                            transferId,
                            chunkIndex: index,
                            totalChunks: chunks.length,
                            file: blob,
                        }
                    }

                    // Respect channel backpressure so large files don't blow up memory
                    await waitForBuffer(peerId)
                    await PeerConnection.sendConnection(peerId, chunkMessage)

                    bytesSent += chunk.data.byteLength
                    if (!sentIndexes.has(index)) {
                        sentIndexes.add(index)
                        const elapsed = Date.now() - startTime
                        const speed = FileService.calculateSpeed(bytesSent, elapsed)
                        const progress = Math.min(100, Math.round((sentIndexes.size / chunks.length) * 100))
                        dispatch(fileTransferProgress(transferId, progress, speed))
                    }

                    // Yield to allow React to process the progress update
                    await new Promise<void>((resolve) => setTimeout(resolve, 0))
                }

                let pendingIndexes = chunks.map((_, i) => i)
                for (let round = 0; ; round++) {
                    for (const index of pendingIndexes) {
                        await sendChunk(index)
                    }

                    // 4. Signal end; the receiver verifies chunk completeness
                    await PeerConnection.sendConnection(peerId, {
                        dataType: DataType.FILE,
                        message: 'FILE_END',
                        transferId,
                    })

                    const answer = await waitForEndAnswer(transferId, END_ANSWER_TIMEOUT)
                    if (answer.kind === 'complete') break
                    if (round >= MAX_RETRANSMIT_ROUNDS) {
                        throw new Error('Transfer failed after too many retransmission rounds')
                    }
                    log.warn('Retransmitting ' + answer.missing.length + ' chunks for transfer: ' + transferId
                        + ', round ' + (round + 1))
                    pendingIndexes = answer.missing
                }

                dispatch(fileTransferComplete(transferId))
                clearTransferState(transferId)
                log.info('File sent successfully: ' + file.name)
            } catch (err: any) {
                log.error('File transfer failed', err)
                const message = err?.message || 'Transfer failed'
                const isCancelled = message === 'Transfer cancelled'
                if (isCancelled) {
                    dispatch(fileTransferCancel(transferId))
                } else {
                    dispatch(fileTransferError(transferId, message))
                }
                clearTransferState(transferId)
                // Tell the receiver to clean up (harmless if it never started)
                PeerConnection.sendConnection(peerId, {
                    dataType: DataType.FILE,
                    message: 'FILE_CANCEL',
                    transferId,
                }).catch(() => {})
            }
        },
        [selectedPeerId, myId, dispatch, encryptionEnabled, maxFileSize],
    )

    const acceptFile = useCallback(
        (transferId: string) => {
            log.info('Accepting file transfer: ' + transferId)
            dispatch(acceptIncomingFile(transferId) as any)
        },
        [dispatch],
    )

    const rejectFile = useCallback(
        (transferId: string) => {
            log.info('Rejecting file transfer: ' + transferId)
            dispatch(rejectIncomingFile(transferId) as any)
        },
        [dispatch],
    )

    const cancelTransfer = useCallback(
        (transferId: string) => {
            log.warn('Cancelling file transfer: ' + transferId)
            const transfer = transfers[transferId]
            const peerId = transfer?.peerId

            if (transfer?.direction === 'receive') {
                // Stop receiving and tell the sender to abort
                clearTransferState(transferId)
                dispatch(filePendingRemove(transferId))
                if (peerId) {
                    PeerConnection.sendConnection(peerId, {
                        dataType: DataType.FILE,
                        message: 'FILE_CANCEL',
                        transferId,
                    }).catch(() => {})
                }
            } else {
                // Flag the sending loop; it stops at the next chunk boundary
                markTransferCancelled(transferId)
                dispatch(fileTransferCancel(transferId))
                if (peerId) {
                    PeerConnection.sendConnection(peerId, {
                        dataType: DataType.FILE,
                        message: 'FILE_CANCEL',
                        transferId,
                    }).catch(() => {})
                }
            }
        },
        [transfers, dispatch],
    )

    return {
        transfers,
        pendingFiles,
        sendFile,
        acceptFile,
        rejectFile,
        cancelTransfer,
    }
}
