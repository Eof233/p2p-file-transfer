import { PeerActionType } from "./peerTypes";
import { Dispatch } from "redux";
import { DataType, PeerConnection } from "../../helpers/peer";
import { addConnectionList, removeConnectionList } from "../connection/connectionActions";
import { addConnectionRequest } from "../connection/connectionRequestActions";
import { createLogger } from "../../services/logService";

const log = createLogger('PeerActions')

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
        log.info('Starting peer session')
        dispatch(setLoading(true))
        try {
            const id = await PeerConnection.startPeerSession()
            PeerConnection.onIncomingConnection((conn) => {
                const peerId = conn.peer
                log.info('Incoming connection from peer: ' + peerId)
                // Don't auto-accept - dispatch a connection request instead
                dispatch(addConnectionRequest(peerId))
            })
            log.debug('Peer session started successfully with ID: ' + id)
            dispatch(startPeerSession(id))
            dispatch(setLoading(false))
        } catch (err) {
            log.error('Failed to start peer session', err)
            dispatch(setLoading(false))
        }
    })
