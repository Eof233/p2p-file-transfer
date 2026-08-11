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

    if (data.dataType === DataType.FILE) {
        const { transferId, message: fileMessage } = data

        if (fileMessage === 'FILE_START' && transferId) {
            log.info('File transfer started from peer: ' + peerId + ', transfer: ' + transferId + ', file: ' + data.fileName)

            // Create pending transfer entry
            if (!pendingFileTransfers.has(transferId)) {
                pendingFileTransfers.set(transferId, {
                    chunks: new Map(),
                    metadata: {
                        fileName: data.fileName || 'unknown',
                        fileSize: data.fileSize || 0,
                        fileType: data.fileType || 'application/octet-stream',
                        totalChunks: 0,
                    },
                    peerId,
                })
            }

            // Create transfer record for progress tracking
            dispatch(fileTransferStart({
                id: transferId,
                fileName: data.fileName || 'unknown',
                fileSize: data.fileSize || 0,
                fileType: data.fileType || 'application/octet-stream',
                peerId,
                direction: 'receive',
                progress: 0,
                status: 'transferring',
            }))

            // Show file in chat immediately
            dispatch(addChatMessage(peerId, {
                id: transferId,
                senderId: peerId,
                content: data.fileName || '',
                timestamp: Date.now(),
                type: 'file',
                status: 'delivered',
                fileName: data.fileName,
                fileSize: data.fileSize,
                fileType: data.fileType,
                transferId,
            } as ChatMessage))
            return
        }

        if (fileMessage === 'FILE_CHUNK' && transferId) {
            const { chunkIndex, totalChunks, file } = data

            if (file === undefined || chunkIndex === undefined || !totalChunks) {
                log.warn('Invalid FILE_CHUNK received from peer: ' + peerId)
                return
            }

            // Ensure pending entry exists
            if (!pendingFileTransfers.has(transferId)) {
                pendingFileTransfers.set(transferId, {
                    chunks: new Map(),
                    metadata: {
                        fileName: 'unknown',
                        fileSize: 0,
                        fileType: 'application/octet-stream',
                        totalChunks,
                    },
                    peerId,
                })
            }

            const entry = pendingFileTransfers.get(transferId)!
            entry.metadata.totalChunks = totalChunks

            // Store chunk (handle both Blob and ArrayBuffer)
            const chunkBlob = file instanceof Blob ? file : new Blob([file as ArrayBuffer], { type: entry.metadata.fileType })
            entry.chunks.set(chunkIndex, chunkBlob)

            // Update progress
            const progress = Math.round((entry.chunks.size / totalChunks) * 100)
            dispatch(fileTransferProgress(transferId, progress))
            return
        }

        if (fileMessage === 'FILE_END' && transferId) {
            const entry = pendingFileTransfers.get(transferId)

            if (!entry || entry.chunks.size < entry.metadata.totalChunks) {
                log.warn('FILE_END received but not all chunks present for transfer: ' + transferId)
                return
            }

            log.info('File transfer complete, reassembling: ' + transferId)

            // Update metadata from FILE_END if available
            if (data.fileName) entry.metadata.fileName = data.fileName
            if (data.fileSize) entry.metadata.fileSize = data.fileSize
            if (data.fileType) entry.metadata.fileType = data.fileType

            // Reassemble chunks in order
            const sortedChunks: Blob[] = []
            for (let i = 0; i < entry.metadata.totalChunks; i++) {
                sortedChunks.push(entry.chunks.get(i)!)
            }
            const blob = new Blob(sortedChunks, { type: entry.metadata.fileType })

            // Mark transfer as complete and store blob for download
            dispatch(fileTransferComplete(transferId, blob))

            // Clean up
            pendingFileTransfers.delete(transferId)
            return
        }

        log.warn('Unknown FILE message type from peer: ' + peerId + ', message: ' + fileMessage)
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
