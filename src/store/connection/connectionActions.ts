import { ConnectionActionType } from "./connectionTypes";
import { Dispatch } from "redux";
import { DataType, PeerConnection } from "../../helpers/peer";
import { handleReceivedData, clearReceiveQueue } from "./receiveData";
import { sendReadReceipts } from "../chat/chatActions";
import { clearReceiptQueue } from "../chat/receiptQueue";
import { removeConnectionRequest } from "./connectionRequestActions";
import { encryptionManager } from "../../services/encryptionService";
import { toast } from "../../services/toastService";
import { translations, getStoredLanguage } from "../../utils/i18n";
import { STORAGE_KEYS } from "../../utils/constants";
import { createLogger } from "../../services/logService";
import { encryptedStorage } from "../../services/encryptedStorageService";
import { store } from "../index";

const log = createLogger('ConnectionActions')

/** localStorage key for recent peer IDs (shared with the settings storage). */
const CONNECTION_HISTORY_KEY = STORAGE_KEYS.CONNECTION_HISTORY
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

/** Mark a peer as being auto-reconnected (kept in the list). */
export const setReconnecting = (id: string) => ({
    type: ConnectionActionType.CONNECTION_RECONNECTING, id
})

/** Mark a peer as successfully reconnected. */
export const setReconnected = (id: string) => ({
    type: ConnectionActionType.CONNECTION_RECONNECTED, id
})

/** Mark a peer as disconnected after reconnect attempts were exhausted. */
export const setReconnectFailed = (id: string) => ({
    type: ConnectionActionType.CONNECTION_RECONNECT_FAILED, id
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
        void encryptedStorage.setItem(CONNECTION_HISTORY_KEY, JSON.stringify(deduped))
    } catch (err) {
        log.warn('Failed to persist connection history', err)
    }
})

export const loadConnectionHistoryState: () => (dispatch: Dispatch) => Promise<void>
    = () => async (dispatch) => {
    try {
        const stored = await encryptedStorage.getItem(CONNECTION_HISTORY_KEY)
        if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) {
                dispatch(loadConnectionHistory(parsed.filter((e) => typeof e === 'string')))
            }
        }
    } catch (err) {
        log.warn('Failed to load connection history', err)
    }
}

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

// --- Automatic data-channel reconnect --------------------------------------
// peer.ts notifies us whenever an established data channel closes for a reason
// other than an explicit disconnect or session stop. We dial the peer back
// with fresh metadata (which re-runs the ECDH session setup) using exponential
// backoff, and only give up on terminal errors or after the attempt budget.

const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 30000

interface ReconnectState {
    timer: ReturnType<typeof setTimeout> | undefined
    cancelled: boolean
}

const reconnectStates: Map<string, ReconnectState> = new Map()

// Register once (module scope) so both outgoing and incoming channels trigger
// a reconnect when they drop.
PeerConnection.onConnectionClosed((peerId) => {
    store.dispatch(reconnectPeer(peerId) as any)
})

/** Errors that mean the remote ID is unreachable for good (session restarted). */
const isTerminalReconnectError = (err: any): boolean => {
    const type = err?.type as string | undefined
    if (type === 'peer-unavailable' || type === 'peer-not-found') return true
    const message = typeof err?.message === 'string' ? err.message : ''
    return message.includes('peer-unavailable') || message.includes('peer-not-found')
}

/**
 * Re-wire the data pipeline for a re-established channel: re-register the
 * single incoming-data pipeline, re-arm the disconnect cleanup, drop anything
 * still queued for the dead channel and surface the restored state.
 */
const onReconnectEstablished = (dispatch: Dispatch, peerId: string): void => {
    log.info('Data channel re-established with peer: ' + peerId)

    // Re-register the incoming-data pipeline handler for the new channel.
    PeerConnection.onConnectionReceiveData(peerId, (data) => {
        handleReceivedData(peerId, data, dispatch)
    })

    // Re-arm the disconnect cleanup for the new channel.
    PeerConnection.onConnectionDisconnected(peerId, () => {
        log.info('Connection closed: ' + peerId)
        encryptionManager.removeSession(peerId)
        clearReceiveQueue(peerId)
        dispatch(removeConnectionList(peerId))
    })

    // The old channel is dead; drop any receipts still queued for it.
    clearReceiptQueue(peerId)

    // Clear any leftover connection-request entry for this peer.
    dispatch(removeConnectionRequest(peerId))
    dispatch(setReconnected(peerId))
    toast({
        title: translations[getStoredLanguage()].reconnected,
        variant: 'success',
    })
}

const finishReconnect = (dispatch: Dispatch, peerId: string): void => {
    reconnectStates.delete(peerId)
    dispatch(setReconnectFailed(peerId))
    dispatch(removeConnectionRequest(peerId))
    toast({
        title: translations[getStoredLanguage()].reconnectFailed,
        variant: 'error',
    })
}

const runReconnectAttempt = async (
    dispatch: Dispatch,
    getState: () => any,
    peerId: string,
    state: ReconnectState,
    attempt: number,
): Promise<void> => {
    if (state.cancelled) return

    // Peer session was stopped: drop the loop silently.
    if (!PeerConnection.getPeer()) {
        reconnectStates.delete(peerId)
        dispatch(setReconnected(peerId))
        return
    }

    // The peer's own reconnect won the race; the channel is already live.
    if (PeerConnection.isConnected(peerId)) {
        onReconnectEstablished(dispatch, peerId)
        reconnectStates.delete(peerId)
        return
    }

    try {
        // Re-run the same metadata path as the first connect so the new
        // channel carries a fresh ephemeral ECDH key.
        const encryptionEnabled = getState().settings.encryptionEnabled
        let metadata: PeerMetadata | undefined
        if (encryptionEnabled && encryptionManager.isReady()) {
            try {
                metadata = {
                    publicKey: await encryptionManager.getPublicKeyBase64(),
                    fingerprint: encryptionManager.getFingerprint(),
                }
            } catch (err) {
                log.warn('Could not attach public key metadata on reconnect', err)
            }
        }

        await PeerConnection.connectPeer(peerId, metadata)
        if (state.cancelled) return
        onReconnectEstablished(dispatch, peerId)
        reconnectStates.delete(peerId)
    } catch (err: any) {
        if (state.cancelled) return

        // The channel came up through the other side while we dialed.
        if (PeerConnection.isConnected(peerId)) {
            onReconnectEstablished(dispatch, peerId)
            reconnectStates.delete(peerId)
            return
        }

        // Session stopped mid-attempt.
        if (!PeerConnection.getPeer()) {
            reconnectStates.delete(peerId)
            dispatch(setReconnected(peerId))
            return
        }

        // Terminal: the remote restarted its session and has a new Peer ID.
        if (isTerminalReconnectError(err)) {
            log.error('Reconnect failed for peer: ' + peerId, err)
            finishReconnect(dispatch, peerId)
            return
        }

        log.warn('Reconnect attempt ' + attempt + ' failed for peer: ' + peerId, err)
        scheduleReconnectAttempt(dispatch, getState, peerId, state, attempt + 1)
    }
}

const scheduleReconnectAttempt = (
    dispatch: Dispatch,
    getState: () => any,
    peerId: string,
    state: ReconnectState,
    attempt: number,
): void => {
    if (state.cancelled) return
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
        log.warn('Reconnect attempts exhausted for peer: ' + peerId)
        finishReconnect(dispatch, peerId)
        return
    }
    const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1),
        RECONNECT_MAX_DELAY_MS,
    )
    log.info('Reconnect attempt ' + attempt + '/' + MAX_RECONNECT_ATTEMPTS
        + ' for peer: ' + peerId + ' in ' + delay + 'ms')
    state.timer = setTimeout(() => {
        state.timer = undefined
        void runReconnectAttempt(dispatch, getState, peerId, state, attempt)
    }, delay)
}

/**
 * Start (or join) an automatic reconnect loop for a peer whose data channel
 * closed unexpectedly. Only peers we had an established connection with are
 * reconnected; the loop stops on success, terminal errors, an explicit
 * disconnect or the session stopping.
 */
export const reconnectPeer: (peerId: string) => (dispatch: Dispatch, getState: () => any) => void
    = (peerId: string) => (dispatch, getState) => {
    if (!getState().connection.list.includes(peerId)) {
        log.debug('Not reconnecting unaccepted peer: ' + peerId)
        return
    }
    if (reconnectStates.has(peerId)) {
        log.debug('Reconnect already in progress for peer: ' + peerId)
        return
    }
    log.info('Starting data-channel reconnect for peer: ' + peerId)
    const state: ReconnectState = { timer: undefined, cancelled: false }
    reconnectStates.set(peerId, state)
    dispatch(setReconnecting(peerId))
    scheduleReconnectAttempt(dispatch, getState, peerId, state, 1)
}

/**
 * Stop an in-flight reconnect loop (explicit user disconnect). Idempotent;
 * safe to call for peers that are not reconnecting.
 */
export const cancelReconnect = (peerId: string): void => {
    const state = reconnectStates.get(peerId)
    if (!state) return
    log.info('Cancelling reconnect for peer: ' + peerId)
    state.cancelled = true
    if (state.timer !== undefined) {
        clearTimeout(state.timer)
        state.timer = undefined
    }
    reconnectStates.delete(peerId)
    store.dispatch(setReconnectFailed(peerId) as any)
    store.dispatch(removeConnectionRequest(peerId) as any)
}
