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
