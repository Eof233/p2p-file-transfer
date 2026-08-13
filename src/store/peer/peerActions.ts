import { PeerActionType } from "./peerTypes";
import { Dispatch } from "redux";
import { PeerConnection } from "../../helpers/peer";
import { removeConnectionList } from "../connection/connectionActions";
import { addConnectionRequest, removeConnectionRequest } from "../connection/connectionRequestActions";
import { handleReceivedData, clearReceiveQueue } from "../connection/receiveData";
import { encryptionManager } from "../../services/encryptionService";
import { createLogger } from "../../services/logService";

const log = createLogger('PeerActions')

interface PeerMetadata {
    publicKey?: string
    fingerprint?: string
}

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

        // Guard against double start: a Peer instance already exists
        if (PeerConnection.getPeer()) {
            log.warn('Peer session already started, ignoring')
            return
        }

        dispatch(setLoading(true))
        try {
            // Prepare encryption material (RSA key pair) so it can be attached
            // as connection metadata; safe to call multiple times.
            try {
                await encryptionManager.init()
            } catch (err) {
                log.error('Encryption init failed; continuing without E2E', err)
            }

            const id = await PeerConnection.startPeerSession()
            PeerConnection.onIncomingConnection((conn) => {
                const peerId = conn.peer
                log.info('Incoming connection from peer: ' + peerId)
                const metadata = conn.metadata as PeerMetadata | undefined
                // Don't auto-accept - dispatch a connection request instead.
                // Include the remote fingerprint when the peer sent it.
                dispatch(addConnectionRequest(peerId, metadata?.fingerprint))

                // Register the data handler IMMEDIATELY (before the user accepts):
                // the initiator sends its KEY_EXCHANGE as soon as the channel
                // opens, and a late registration would miss it.
                PeerConnection.onConnectionReceiveData(peerId, (data) => {
                    handleReceivedData(peerId, data, dispatch)
                })

                // Clean up whenever the connection closes, accepted or not.
                conn.on('close', () => {
                    dispatch(removeConnectionRequest(peerId))
                    dispatch(removeConnectionList(peerId))
                    encryptionManager.removeSession(peerId)
                    clearReceiveQueue(peerId)
                })
            })
            log.debug('Peer session started successfully with ID: ' + id)
            dispatch(startPeerSession(id))
            dispatch(setLoading(false))
        } catch (err) {
            log.error('Failed to start peer session', err)
            dispatch(setLoading(false))
            dispatch(setError(err instanceof Error ? err.message : String(err)))
        }
    })

const setError = (message: string) => ({
    type: PeerActionType.PEER_ERROR, error: message
})
