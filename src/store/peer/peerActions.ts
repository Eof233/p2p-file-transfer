import { PeerActionType } from "./peerTypes";
import { Dispatch } from "redux";
import { DataType, PeerConnection } from "../../helpers/peer";
import { addConnectionList, removeConnectionList } from "../connection/connectionActions";
import { addConnectionRequest } from "../connection/connectionRequestActions";

export const startPeerSession = (id: string) => ({
    type: PeerActionType.PEER_SESSION_START, id
})

export const stopPeerSession = () => ({
    type: PeerActionType.PEER_SESSION_STOP,
})

export const setLoading = (loading: boolean) => ({
    type: PeerActionType.PEER_LOADING, loading
})

export const startPeer: () => (dispatch: Dispatch) => Promise<void>
    = () => (async (dispatch) => {
        dispatch(setLoading(true))
        try {
            const id = await PeerConnection.startPeerSession()
            PeerConnection.onIncomingConnection((conn) => {
                const peerId = conn.peer
                console.log("Incoming connection: " + peerId)
                // Don't auto-accept - dispatch a connection request instead
                dispatch(addConnectionRequest(peerId))
            })
            dispatch(startPeerSession(id))
            dispatch(setLoading(false))
        } catch (err) {
            console.log(err)
            dispatch(setLoading(false))
        }
    })
