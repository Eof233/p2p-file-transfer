import { ConnectionActionType } from "./connectionTypes";
import { Dispatch } from "redux";
import { DataType, PeerConnection } from "../../helpers/peer";
import { handleReceivedData, clearReceiveQueue } from "./receiveData";
import { encryptionManager } from "../../services/encryptionService";
import { createLogger } from "../../services/logService";

const log = createLogger('ConnectionActions')

interface PeerMetadata {
    publicKey?: string
    fingerprint?: string
}

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

export const connectPeer: (id: string) => (dispatch: Dispatch, getState: () => any) => Promise<void>
    = (id: string) => (async (dispatch, getState) => {
        log.info('Connecting to peer: ' + id)
        dispatch(setLoading(true))
        dispatch(setError(undefined))

        try {
            const encryptionEnabled = getState().settings.encryptionEnabled
            let metadata: PeerMetadata | undefined

            // Attach our public key as connection metadata so the remote side
            // can fingerprint us and decrypt the session key we send next.
            if (encryptionEnabled && encryptionManager.isReady()) {
                try {
                    metadata = {
                        publicKey: await encryptionManager.getPublicKeyBase64(),
                        fingerprint: encryptionManager.getFingerprint(),
                    }
                } catch (err) {
                    log.warn('Could not attach public key metadata', err)
                }
            }

            await PeerConnection.connectPeer(id, metadata)

            // Set up disconnect handler
            PeerConnection.onConnectionDisconnected(id, () => {
                log.info('Connection closed: ' + id)
                encryptionManager.removeSession(id)
                clearReceiveQueue(id)
                dispatch(removeConnectionList(id))
            })

            // Set up data handler - dispatch incoming data to the Redux store
            PeerConnection.onConnectionReceiveData(id, (data) => {
                handleReceivedData(id, data, dispatch)
            })

            // Initiator side of the key exchange: encrypt a fresh session key
            // with the peer's public key (received via connection metadata).
            if (encryptionEnabled && encryptionManager.isReady()) {
                const peerMetadata = PeerConnection.getPeerMetadata(id) as PeerMetadata | undefined
                if (peerMetadata?.publicKey && !encryptionManager.hasSessionKey(id)) {
                    try {
                        const keyData = await encryptionManager.createSessionKey(id, peerMetadata.publicKey)
                        await PeerConnection.sendConnection(id, { dataType: DataType.KEY_EXCHANGE, keyData })
                    } catch (err) {
                        log.error('Key exchange failed for peer: ' + id, err)
                    }
                }
            }

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
