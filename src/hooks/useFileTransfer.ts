import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import type { AppDispatch } from '../store'
import { FileTransfer } from '../store/file/fileTypes'
import {
    fileTransferStart,
    fileTransferProgress,
    fileTransferComplete,
    fileTransferError,
    fileTransferCancel,
    fileTransferPause,
    fileTransferResume,
    fileTransferInterrupt,
    filePendingRemove,
    acceptIncomingFile,
    rejectIncomingFile,
} from '../store/file/fileActions'
import {
    markTransferCancelled,
    isTransferCancelled,
    markTransferPaused,
    isTransferPaused,
    unmarkTransferPaused,
    waitForAcceptance,
    waitForEndAnswer,
    clearTransferState,
    interruptTransferState,
    setSenderTransferState,
    getSenderTransferState,
    sendFileControlMessage,
    TransferInterruptedError,
    EndAnswer,
} from '../store/file/transferCoordinator'
import { addChatMessage } from '../store/chat/chatActions'
import { ChatMessage } from '../store/chat/chatTypes'
import { DataType, PeerConnection } from '../helpers/peer'
import { FileService } from '../services/fileService'
import { encryptionManager } from '../services/encryptionService'
import { validateFile } from '../utils/validators'
import { formatFileSize } from '../utils/formatters'
import { useI18n } from './useI18n'
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

/**
 * Drive the chunk-sending state machine for one transfer. Position state lives
 * in the module-level sender state (transferCoordinator), so an interrupted
 * transfer resumes from the next unsent chunk index. The data connection is
 * looked up live on every send (never captured), so a data channel that the
 * reconnect pipeline re-established is picked up automatically.
 */
const runTransferLoop = async (transferId: string, dispatch: AppDispatch): Promise<void> => {
    const state = getSenderTransferState(transferId)
    if (!state) {
        throw new Error('Sender transfer state lost')
    }
    if (state.active) {
        throw new Error('Transfer loop already running')
    }
    state.active = true
    const { peerId, chunks, useEncryption, fileType } = state

    const sendChunk = async (index: number): Promise<void> => {
        if (isTransferCancelled(transferId)) {
            throw new Error('Transfer cancelled')
        }

        // Pause support: hold between chunks while the transfer is paused.
        // Cancel is still checked so a paused transfer can be aborted.
        while (isTransferPaused(transferId)) {
            if (isTransferCancelled(transferId)) {
                throw new Error('Transfer cancelled')
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 100))
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
            const blob = new Blob([chunk.data], { type: fileType })
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
        try {
            await PeerConnection.sendConnection(peerId, chunkMessage)
        } catch (err: any) {
            throw new TransferInterruptedError('Connection lost while sending chunk ' + index + ': ' + (err?.message ?? 'unknown error'))
        }

        state.bytesSent += chunk.data.byteLength
        if (!state.sentIndexes.has(index)) {
            state.sentIndexes.add(index)
            const elapsed = Date.now() - state.startTime
            const speed = FileService.calculateSpeed(state.bytesSent, elapsed)
            const progress = Math.min(100, Math.round((state.sentIndexes.size / chunks.length) * 100))
            dispatch(fileTransferProgress(transferId, progress, speed))
        }

        // Yield to allow React to process the progress update
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }

    const sendRounds = async (): Promise<void> => {
        for (let round = state.retransmitRounds; ; round++) {
            // Send everything still pending in this pass: the unsent tail on the
            // first run, or the receiver's FILE_MISSING list on later runs.
            while (state.pendingIndexes.length > 0) {
                const index = state.pendingIndexes[0]
                await sendChunk(index)
                state.pendingIndexes.shift()
            }

            // Signal end; the receiver verifies chunk completeness and answers
            // FILE_COMPLETE or FILE_MISSING (missing chunk indexes).
            try {
                await PeerConnection.sendConnection(peerId, {
                    dataType: DataType.FILE,
                    message: 'FILE_END',
                    transferId,
                })
            } catch (err: any) {
                throw new TransferInterruptedError('Connection lost while sending FILE_END: ' + (err?.message ?? 'unknown error'))
            }

            let answer: EndAnswer
            try {
                answer = await waitForEndAnswer(transferId, END_ANSWER_TIMEOUT)
            } catch (err: any) {
                throw new TransferInterruptedError('No completion answer, connection lost: ' + (err?.message ?? 'unknown error'))
            }

            if (answer.kind === 'complete') return
            if (round >= MAX_RETRANSMIT_ROUNDS) {
                throw new Error('Transfer failed after too many retransmission rounds')
            }
            log.warn('Retransmitting ' + answer.missing.length + ' chunks for transfer: ' + transferId
                + ', round ' + (round + 1))
            state.retransmitRounds = round + 1
            state.pendingIndexes = [...answer.missing]
        }
    }

    try {
        await sendRounds()
    } finally {
        state.active = false
    }
}

/**
 * Classify a send-phase failure: user cancel, interrupted (resumable) or a
 * permanent error. Interrupted transfers keep their module-level sender state
 * (and the receiver keeps its chunk buffer) so the transfer can be resumed
 * once the data channel is back; other failures tell the receiver to clean up
 * via FILE_CANCEL.
 */
const handleSendFailure = (
    transferId: string,
    peerId: string,
    err: any,
    dispatch: AppDispatch,
    encryptionEnabled: boolean,
): void => {
    log.error('File transfer failed', err)
    const message = err?.message || 'Transfer failed'
    if (message === 'Transfer cancelled') {
        dispatch(fileTransferCancel(transferId))
        clearTransferState(transferId)
    } else if (err instanceof TransferInterruptedError) {
        // The data channel dropped mid-transfer. Mark the transfer interrupted
        // instead of erroring out permanently: the sender state and the
        // receiver's buffer are kept so a resume can continue the chunk loop.
        dispatch(fileTransferInterrupt(transferId))
        interruptTransferState(transferId)
        return
    } else {
        dispatch(fileTransferError(transferId, message))
        clearTransferState(transferId)
    }
    // Tell the receiver to clean up (harmless if it never started)
    sendFileControlMessage(peerId, transferId, 'FILE_CANCEL', { encryptionEnabled })
        .catch(() => {})
}

export const useFileTransfer = () => {
    const dispatch = useAppDispatch()
    const { t } = useI18n()

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

                // 3. Register the sender-side transfer state so an interrupted
                //    transfer can be resumed from the next unsent chunk index.
                setSenderTransferState(transferId, {
                    peerId,
                    fileName: file.name,
                    fileType: file.type,
                    chunks,
                    pendingIndexes: chunks.map((_, i) => i),
                    sentIndexes: new Set<number>(),
                    retransmitRounds: 0,
                    useEncryption,
                    startTime: Date.now(),
                    bytesSent: 0,
                    active: false,
                })

                // 4. Send chunks, then hand over to the retransmission loop:
                //    FILE_END → receiver answers FILE_COMPLETE or FILE_MISSING.
                await runTransferLoop(transferId, dispatch)

                dispatch(fileTransferComplete(transferId))
                clearTransferState(transferId)
                log.info('File sent successfully: ' + file.name)
            } catch (err: any) {
                handleSendFailure(transferId, peerId, err, dispatch, encryptionEnabled)
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
                    sendFileControlMessage(peerId, transferId, 'FILE_CANCEL', { encryptionEnabled })
                        .catch(() => {})
                }
            } else {
                // Flag the sending loop; it stops at the next chunk boundary
                markTransferCancelled(transferId)
                dispatch(fileTransferCancel(transferId))
                if (peerId) {
                    sendFileControlMessage(peerId, transferId, 'FILE_CANCEL', { encryptionEnabled })
                        .catch(() => {})
                }
                // An interrupted transfer has no live loop to run the cleanup,
                // so drop its kept sender state here.
                if (transfer?.interrupted) {
                    clearTransferState(transferId)
                }
            }
        },
        [transfers, dispatch, encryptionEnabled],
    )

    const pauseTransfer = useCallback(
        (transferId: string) => {
            const transfer = transfers[transferId]
            if (!transfer || transfer.direction !== 'send') {
                return
            }
            // Interrupted transfers have no live loop to pause
            if (transfer.interrupted || isTransferCancelled(transferId) || isTransferPaused(transferId)) {
                return
            }
            log.info('Pausing file transfer: ' + transferId)
            markTransferPaused(transferId)
            dispatch(fileTransferPause(transferId))
        },
        [transfers, dispatch],
    )

    const resumeTransfer = useCallback(
        async (transferId: string) => {
            const transfer = transfers[transferId]
            if (!transfer || transfer.direction !== 'send') {
                return
            }
            const peerId = transfer.peerId

            // Paused: wake the live send loop (it is waiting between chunks).
            if (isTransferPaused(transferId)) {
                const state = getSenderTransferState(transferId)
                if (state) state.startTime = Date.now()
                log.info('Resuming paused transfer: ' + transferId)
                unmarkTransferPaused(transferId)
                dispatch(fileTransferResume(transferId))
                return
            }

            if (!transfer.interrupted) {
                log.debug('Transfer is neither paused nor interrupted: ' + transferId)
                return
            }

            // Interrupted: restart the chunk loop from the module-level sender
            // state. The loop resolves the current live connection per send, so
            // a data channel re-established by the reconnect pipeline is used.
            const state = getSenderTransferState(transferId)
            if (!state) {
                log.warn('Cannot resume transfer, sender state lost: ' + transferId)
                dispatch(fileTransferError(transferId, t.resumeNotAvailable))
                return
            }
            if (state.active) {
                log.warn('Transfer loop already running, ignoring resume: ' + transferId)
                return
            }

            log.info('Resuming interrupted transfer: ' + transferId)
            state.startTime = Date.now()
            dispatch(fileTransferResume(transferId))
            try {
                await runTransferLoop(transferId, dispatch)
                dispatch(fileTransferComplete(transferId))
                clearTransferState(transferId)
                log.info('File sent successfully after resume: ' + state.fileName)
            } catch (err: any) {
                handleSendFailure(transferId, peerId, err, dispatch, encryptionEnabled)
            }
        },
        [transfers, dispatch, encryptionEnabled, t],
    )

    return {
        transfers,
        pendingFiles,
        sendFile,
        acceptFile,
        rejectFile,
        cancelTransfer,
        pauseTransfer,
        resumeTransfer,
    }
}
