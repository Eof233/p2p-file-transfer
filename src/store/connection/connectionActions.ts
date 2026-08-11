import { ConnectionActionType } from "./connectionTypes";
import { Dispatch } from "redux";
import { DataType, PeerConnection, Data } from "../../helpers/peer";
import { createLogger } from "../../services/logService";
import { addChatMessage, setChatTyping } from "../chat/chatActions";
import { ChatMessage } from "../chat/chatTypes";
import { fileTransferStart, fileTransferProgress, fileTransferComplete } from "../file/fileActions";
import { FileTransfer } from "../file/fileTypes";

const log = createLogger('ConnectionActions')

// Module-level chunk accumulator for incoming file transfers
interface PendingTransfer {
    chunks: Map<number, Blob>
    metadata: { fileName: string; fileSize: number; fileType: string; totalChunks: number }
    peerId: string
}
const pendingFileTransfers: Map<string, PendingTransfer> = new Map()

export const changeConnectionInput = (id: string) => ({
    type: ConnectionActionType.CONNECTION_INPUT_CHANGE, id
})

export const setLoading = (loading: boolean) => ({
    type: ConnectionActionType.CONNECTION_CONNECT_LOADING, loading
})

export const setError = (error: string | undefined) => ({
    type: ConnectionActionType.CONNECTION_ERROR, error
})

export const addConnectionList = (id: string) => ({
    type: ConnectionActionType.CONNECTION_LIST_ADD, id
})

export const removeConnectionList = (id: string) => ({
    type: ConnectionActionType.CONNECTION_LIST_REMOVE, id
})

export const selectItem = (id: string) => ({
    type: ConnectionActionType.CONNECTION_ITEM_SELECT, id
})

export const resetConnection = () => ({
    type: ConnectionActionType.CONNECTION_RESET
})

/**
 * Processes received data from a peer and dispatches appropriate Redux actions.
 * Handles chat messages, typing indicators, and other data types.
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

export const connectPeer: (id: string) => (dispatch: Dispatch) => Promise<void>
    = (id: string) => (async (dispatch) => {
        log.info('Connecting to peer: ' + id)
        dispatch(setLoading(true))
        dispatch(setError(undefined))

        try {
            await PeerConnection.connectPeer(id)

            // Set up disconnect handler
            PeerConnection.onConnectionDisconnected(id, () => {
                log.info('Connection closed: ' + id)
                dispatch(removeConnectionList(id))
            })

            // Set up data handler - dispatch incoming data to the Redux store
            PeerConnection.onConnectionReceiveData(id, (data) => {
                handleReceivedData(id, data, dispatch)
            })

            log.debug('Successfully connected to peer: ' + id)
            dispatch(addConnectionList(id))
            dispatch(setLoading(false))
        } catch (err: any) {
            const errorMessage = err?.message || 'Failed to connect'
            log.error('Failed to connect to peer: ' + id, err)
            dispatch(setLoading(false))
            dispatch(setError(errorMessage))

            // Clear error after 5 seconds
            setTimeout(() => {
                dispatch(setError(undefined))
            }, 5000)
        }
    })
