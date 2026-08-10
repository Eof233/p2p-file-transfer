import { Dispatch } from "redux";
import { ConnectionRequestActionType } from "./connectionRequestTypes";
import { DataType, PeerConnection, Data } from "../../helpers/peer";
import { addConnectionList, removeConnectionList } from "./connectionActions";
import { addChatMessage, setChatTyping } from "../chat/chatActions";
import { ChatMessage } from "../chat/chatTypes";
import { createLogger } from "../../services/logService";

const log = createLogger('ConnectionRequestActions')

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
