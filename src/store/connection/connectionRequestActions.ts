import { Dispatch } from "redux";
import { ConnectionRequestActionType } from "./connectionRequestTypes";
import { PeerConnection } from "../../helpers/peer";
import { addConnectionList, removeConnectionList } from "./connectionActions";

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

export const acceptConnection: (peerId: string) => (dispatch: Dispatch) => void
    = (peerId: string) => (dispatch) => {
        dispatch(acceptConnectionRequest(peerId))
        dispatch(addConnectionList(peerId))

        PeerConnection.onConnectionDisconnected(peerId, () => {
            console.log("Connection closed: " + peerId)
            dispatch(removeConnectionList(peerId))
        })

        PeerConnection.onConnectionReceiveData(peerId, (data) => {
            console.log("Receiving data from " + peerId, data.dataType)
        })

        dispatch(clearCompletedRequests())
    }

export const rejectConnection: (peerId: string) => (dispatch: Dispatch) => void
    = (peerId: string) => (dispatch) => {
        dispatch(rejectConnectionRequest(peerId))
        PeerConnection.disconnectPeer(peerId)
        dispatch(clearCompletedRequests())
    }
