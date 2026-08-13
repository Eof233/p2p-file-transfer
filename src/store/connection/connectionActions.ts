import { ConnectionActionType } from "./connectionTypes";
import { Dispatch } from "redux";
import { DataType, PeerConnection } from "../../helpers/peer";
import { handleReceivedData, clearReceiveQueue } from "./receiveData";
import { sendReadReceipts } from "../chat/chatActions";
import { encryptionManager } from "../../services/encryptionService";
import { createLogger } from "../../services/logService";

const log = createLogger('ConnectionActions')

/** localStorage key for recent peer IDs (shared with the settings storage). */
const CONNECTION_HISTORY_KEY = 'p2p-messenger-connections'
const MAX_HISTORY_ENTRIES = 10

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

export const addConnectionHistory = (id: string) => ({
    type: ConnectionActionType.CONNECTION_HISTORY_ADD, id
})

export const loadConnectionHistory = (history: string[]) => ({
    type: ConnectionActionType.CONNECTION_HISTORY_LOAD, history
})

/**
 * Select a connection and send read receipts for all its incoming messages
 * (the user is now looking at the conversation).
 */
export const selectConnection: (id: string) => (dispatch: Dispatch) => void
    = (id: string) => ((dispatch) => {
    dispatch(selectItem(id))
    dispatch(sendReadReceipts(id) as any)
})

/** Persist a peer ID into the recent-connections history (localStorage). */
export const rememberConnection: (id: string) => (dispatch: Dispatch, getState: () => any) => void
    = (id: string) => ((dispatch, getState) => {
    dispatch(addConnectionHistory(id))
    try {
        const { history } = getState().connection
        const deduped = [id, ...history.filter((e: string) => e !== id)].slice(0, MAX_HISTORY_ENTRIES)
        localStorage.setItem(CONNECTION_HISTORY_KEY, JSON.stringify(deduped))
    } catch (err) {
        log.warn('Failed to persist connection history', err)
    }
})

export const loadConnectionHistoryState: () => (dispatch: Dispatch) => void
    = () => ((dispatch) => {
    try {
        const stored = localStorage.getItem(CONNECTION_HISTORY_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) {
                dispatch(loadConnectionHistory(parsed.filter((e) => typeof e === 'string')))
            }
        }
    } catch (err) {
        log.warn('Failed to load connection history', err)
    }
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
            dispatch(rememberConnection(id) as any)
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
