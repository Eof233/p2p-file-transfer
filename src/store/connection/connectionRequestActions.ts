import { Dispatch } from "redux";
import { ConnectionRequestActionType } from "./connectionRequestTypes";
import { PeerConnection } from "../../helpers/peer";
import { addConnectionList, rememberConnection } from "./connectionActions";
import { createLogger } from "../../services/logService";

const log = createLogger('ConnectionRequestActions')

export const addConnectionRequest = (peerId: string, fingerprint?: string) => ({
    type: ConnectionRequestActionType.CONNECTION_REQUEST_ADD,
    peerId,
    fingerprint,
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

export const removeConnectionRequest = (peerId: string) => ({
    type: ConnectionRequestActionType.CONNECTION_REQUEST_REMOVE,
    peerId,
})

export const clearCompletedRequests = () => ({
    type: ConnectionRequestActionType.CONNECTION_REQUEST_CLEAR,
})

/**
 * Accept an incoming connection. The data handler and close-cleanup were
 * already registered in peerActions when the connection opened (so the key
 * exchange is never missed); here we only update the UI state.
 */
export const acceptConnection: (peerId: string) => (dispatch: Dispatch) => void
    = (peerId: string) => (dispatch) => {
        log.info('Accepting connection from peer: ' + peerId)
        dispatch(acceptConnectionRequest(peerId))
        dispatch(addConnectionList(peerId))
        dispatch(rememberConnection(peerId) as any)
        dispatch(clearCompletedRequests())
    }

export const rejectConnection: (peerId: string) => (dispatch: Dispatch) => void
    = (peerId: string) => (dispatch) => {
        log.info('Rejecting connection from peer: ' + peerId)
        dispatch(rejectConnectionRequest(peerId))
        PeerConnection.disconnectPeer(peerId)
        dispatch(clearCompletedRequests())
    }
