import { Dispatch } from "redux";
import { ConnectionRequestActionType } from "./connectionRequestTypes";
import { DataType, PeerConnection, Data } from "../../helpers/peer";
import { addConnectionList, removeConnectionList } from "./connectionActions";
import { addChatMessage, setChatTyping } from "../chat/chatActions";
import { ChatMessage } from "../chat/chatTypes";
import { fileTransferStart, fileTransferProgress, fileTransferComplete } from "../file/fileActions";
import { FileTransfer } from "../file/fileTypes";
import { createLogger } from "../../services/logService";

const log = createLogger('ConnectionRequestActions')

// Module-level chunk accumulator for incoming file transfers
interface PendingTransfer {
    chunks: Map<number, Blob>
    metadata: { fileName: string; fileSize: number; fileType: string; totalChunks: number }
    peerId: string
}
const pendingFileTransfers: Map<string, PendingTransfer> = new Map()

export const addConnectionRequest = (peerId: string) => ({
    type: ConnectionRequestActionType.CONNECTION_REQUEST_ADD,
    peerId,
    timestamp: Date.now(),
})

export const acceptConnectionRequest = (peerId: string) => ({
    type: ConnectionRequestActionType.CONNECTION_REQUEST_ACCEPT,
    peerId,
})

export const rejectConnectionRequest = (peerId: string) => ({
    type: ConnectionRequestActionType.CONNECTION_REQUEST_REJECT,
    peerId,
})

export const clearCompletedRequests = () => ({
    type: ConnectionRequestActionType.CONNECTION_REQUEST_CLEAR,
})

/**
 * Processes received data from a peer and dispatches appropriate Redux actions.
 * Handles chat messages, typing indicators, file chunks, and other data types.
 */
const handleReceivedData = (peerId: string, data: Data, dispatch: Dispatch) => {
    log.debug('Handling received data from peer: ' + peerId + ', type: ' + data.dataType)

    if (data.dataType === DataType.OTHER && data.message) {
        try {
            const parsed = JSON.parse(data.message)

            if (parsed.dataType === 'CHAT_MESSAGE') {
                log.info('Received chat message from peer: ' + peerId)
                const chatMessage: ChatMessage = {
                    id: parsed.id || crypto.randomUUID(),
                    senderId: parsed.senderId || peerId,
                    content: parsed.content,
                    timestamp: parsed.timestamp || Date.now(),
                    type: parsed.type || 'text',
                    status: 'delivered',
                    fileName: parsed.fileName,
                    fileSize: parsed.fileSize,
                    fileType: parsed.fileType,
                    imageData: parsed.imageData,
                }
                dispatch(addChatMessage(peerId, chatMessage))
                return
            }

            if (parsed.dataType === 'TYPING') {
                log.debug('Received typing indicator from peer: ' + peerId)
                dispatch(setChatTyping(peerId, parsed.typing ?? false))
                return
            }
        } catch (e) {
            log.warn('Failed to parse message data from peer: ' + peerId, e)
        }
    }

    if (data.dataType === DataType.FILE && data.transferId) {
        const { transferId, chunkIndex, totalChunks, fileName, fileSize, fileType, file } = data

        if (!file || chunkIndex === undefined || !totalChunks) {
            log.warn('Invalid file chunk received from peer: ' + peerId)
            return
        }

        log.info('Received file chunk from peer: ' + peerId + ', transfer: ' + transferId + ', chunk: ' + chunkIndex + '/' + totalChunks)

        // Create entry on first chunk
        if (!pendingFileTransfers.has(transferId!)) {
            pendingFileTransfers.set(transferId!, {
                chunks: new Map(),
                metadata: {
                    fileName: fileName || 'unknown',
                    fileSize: fileSize || 0,
                    fileType: fileType || 'application/octet-stream',
                    totalChunks,
                },
                peerId,
            })

            // Create transfer record for progress tracking
            const transfer: FileTransfer = {
                id: transferId!,
                fileName: fileName || 'unknown',
                fileSize: fileSize || 0,
                fileType: fileType || 'application/octet-stream',
                peerId,
                direction: 'receive',
                progress: 0,
                status: 'transferring',
            }
            dispatch(fileTransferStart(transfer))
        }

        const entry = pendingFileTransfers.get(transferId!)!

        // Store chunk (handle both Blob and ArrayBuffer)
        const chunkBlob = file instanceof Blob ? file : new Blob([file as ArrayBuffer], { type: entry.metadata.fileType })
        entry.chunks.set(chunkIndex, chunkBlob)

        // Update progress
        const progress = Math.round((entry.chunks.size / entry.metadata.totalChunks) * 100)
        dispatch(fileTransferProgress(transferId!, progress))

        // Check if all chunks received
        if (entry.chunks.size === entry.metadata.totalChunks) {
            log.info('All chunks received for transfer: ' + transferId + ', reassembling...')

            // Reassemble chunks in order
            const sortedChunks: Blob[] = []
            for (let i = 0; i < entry.metadata.totalChunks; i++) {
                sortedChunks.push(entry.chunks.get(i)!)
            }
            const blob = new Blob(sortedChunks, { type: entry.metadata.fileType })

            // Create chat message for the received file
            const chatMessage: ChatMessage = {
                id: crypto.randomUUID(),
                senderId: peerId,
                content: '',
                timestamp: Date.now(),
                type: 'file',
                status: 'delivered',
                fileName: entry.metadata.fileName,
                fileSize: entry.metadata.fileSize,
                fileType: entry.metadata.fileType,
                transferId: transferId!,
            }
            dispatch(addChatMessage(peerId, chatMessage))

            // Auto-download the received file
            try {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = entry.metadata.fileName
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                setTimeout(() => URL.revokeObjectURL(url), 1000)
                log.info('File download triggered: ' + entry.metadata.fileName)
            } catch (e) {
                log.error('Failed to trigger file download', e)
            }

            // Mark transfer as complete and store blob for download
            dispatch(fileTransferComplete(transferId!, blob))

            // Clean up
            pendingFileTransfers.delete(transferId!)
        }
        return
    }

    if (data.dataType === DataType.TYPING) {
        log.debug('Received typing indicator from peer: ' + peerId)
        dispatch(setChatTyping(peerId, true))
    }
}

export const acceptConnection: (peerId: string) => (dispatch: Dispatch) => void
    = (peerId: string) => (dispatch) => {
        log.info('Accepting connection from peer: ' + peerId)
        dispatch(acceptConnectionRequest(peerId))
        dispatch(addConnectionList(peerId))

        PeerConnection.onConnectionDisconnected(peerId, () => {
            log.info('Connection closed: ' + peerId)
            dispatch(removeConnectionList(peerId))
        })

        PeerConnection.onConnectionReceiveData(peerId, (data) => {
            handleReceivedData(peerId, data, dispatch)
        })

        dispatch(clearCompletedRequests())
    }

export const rejectConnection: (peerId: string) => (dispatch: Dispatch) => void
    = (peerId: string) => (dispatch) => {
        log.info('Rejecting connection from peer: ' + peerId)
        dispatch(rejectConnectionRequest(peerId))
        PeerConnection.disconnectPeer(peerId)
        dispatch(clearCompletedRequests())
    }
