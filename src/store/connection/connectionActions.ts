import { ConnectionActionType } from "./connectionTypes";
import { Dispatch } from "redux";
import { DataType, PeerConnection, Data } from "../../helpers/peer";
import { createLogger } from "../../services/logService";
import { addChatMessage, setChatTyping } from "../chat/chatActions";
import { ChatMessage } from "../chat/chatTypes";

const log = createLogger('ConnectionActions')

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
        log.info('Received file from peer: ' + peerId + ', name: ' + data.fileName)
        // File handling is done via file transfer hooks
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
