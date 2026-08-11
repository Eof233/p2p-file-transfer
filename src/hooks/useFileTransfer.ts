import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { FileTransfer, PendingFile } from '../store/file/fileTypes'
import {
    fileTransferStart,
    fileTransferProgress,
    fileTransferComplete,
    fileTransferError,
    acceptFileTransfer,
    cancelFileTransfer,
} from '../store/file/fileActions'
import { addChatMessage } from '../store/chat/chatActions'
import { ChatMessage } from '../store/chat/chatTypes'
import { DataType, PeerConnection } from '../helpers/peer'
import { FileService } from '../services/fileService'
import { createLogger } from '../services/logService'

const log = createLogger('useFileTransfer')

const CHUNK_SIZE = 16 * 1024 // 16KB per chunk

export const useFileTransfer = () => {
    const dispatch = useAppDispatch()

    const transfers = useAppSelector(
        (state: any) => (state.file?.transfers as Record<string, FileTransfer> | undefined) ?? {},
    )

    const pendingFiles = useAppSelector(
        (state: any) => (state.file?.pendingFiles as PendingFile[] | undefined) ?? [],
    )

    const selectedPeerId = useAppSelector((state) => state.connection.selectedId)
    const myId = useAppSelector((state) => state.peer.id)

    const sendFile = useCallback(
        async (file: File) => {
            if (!selectedPeerId) {
                throw new Error('No peer selected')
            }

            log.info('Sending file: ' + file.name + ', size: ' + file.size + ' bytes')

            const transferId = crypto.randomUUID()

            // Create transfer record with 'transferring' status
            const transfer: FileTransfer = {
                id: transferId,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                peerId: selectedPeerId,
                direction: 'send',
                progress: 0,
                status: 'transferring',
            }
            dispatch(fileTransferStart(transfer))

            // Add a chat message of type 'file' so it shows in the chat
            const chatMessage: ChatMessage = {
                id: crypto.randomUUID(),
                senderId: myId || '',
                content: '',
                timestamp: Date.now(),
                type: 'file',
                status: 'sent',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                transferId,
            }
            dispatch(addChatMessage(selectedPeerId, chatMessage))

            // Send file using FILE_START / FILE_CHUNK / FILE_END protocol
            try {
                const chunks = await FileService.chunkFile(file, transferId, CHUNK_SIZE)

                // 1. Send FILE_START with metadata so receiver can show file immediately
                await PeerConnection.sendConnection(selectedPeerId, {
                    dataType: DataType.FILE,
                    message: 'FILE_START',
                    transferId,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                })

                // 2. Send each chunk
                const startTime = Date.now()
                let bytesSent = 0

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i]
                    const blob = new Blob([chunk.data], { type: file.type })

                    await PeerConnection.sendConnection(selectedPeerId, {
                        dataType: DataType.FILE,
                        message: 'FILE_CHUNK',
                        transferId,
                        chunkIndex: i,
                        totalChunks: chunks.length,
                        file: blob,
                    })

                    bytesSent += chunk.data.byteLength
                    const elapsed = Date.now() - startTime
                    const speed = FileService.calculateSpeed(bytesSent, elapsed)
                    const progress = Math.round((bytesSent / file.size) * 100)

                    dispatch(fileTransferProgress(transferId, progress, speed))

                    // Yield to allow React to process the progress update and re-render
                    await new Promise<void>((resolve) => setTimeout(resolve, 0))
                }

                // 3. Send FILE_END completion signal
                await PeerConnection.sendConnection(selectedPeerId, {
                    dataType: DataType.FILE,
                    message: 'FILE_END',
                    transferId,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                })

                dispatch(fileTransferComplete(transferId))
                log.info('File sent successfully: ' + file.name)
            } catch (err: any) {
                log.error('File transfer failed', err)
                dispatch(fileTransferError(transferId, err.message || 'Transfer failed'))
            }
        },
        [selectedPeerId, myId, dispatch],
    )

    const acceptFile = useCallback(
        (transferId: string) => {
            log.info('Accepting file transfer: ' + transferId)
            dispatch(acceptFileTransfer(transferId))
        },
        [dispatch],
    )

    const cancelTransfer = useCallback(
        (transferId: string) => {
            log.warn('Cancelling file transfer: ' + transferId)
            dispatch(cancelFileTransfer(transferId))
        },
        [dispatch],
    )

    return {
        transfers,
        pendingFiles,
        sendFile,
        acceptFile,
        cancelTransfer,
    }
}
