import Peer, { DataConnection, PeerErrorType, PeerError } from "peerjs";
import { createLogger } from '../services/logService'
import { encryptionManager } from '../services/encryptionService'

const log = createLogger('Peer')

export enum DataType {
    FILE = 'FILE',
    MESSAGE = 'MESSAGE',
    IMAGE = 'IMAGE',
    TYPING = 'TYPING',
    KEY_EXCHANGE = 'KEY_EXCHANGE',
    OTHER = 'OTHER'
}

export interface Data {
    dataType: DataType
    file?: Blob | ArrayBuffer
    fileName?: string
    fileType?: string
    fileSize?: number
    message?: string
    imageData?: string
    transferId?: string
    chunkIndex?: number
    totalChunks?: number
    // List of chunk indexes the receiver wants retransmitted (FILE_MISSING)
    missingChunks?: number[]
    // E2E encryption fields: ciphertext travels base64-encoded in `payload`
    encrypted?: boolean
    iv?: string
    payload?: string
    // Key exchange
    keyData?: string
    // PFS (ECDH): the sender's ephemeral P-256 public key (base64 raw) and
    // long-term RSA fingerprint, exchanged so both sides can derive the
    // shared AES session key. No session key ever travels over the wire.
    ephemeralKey?: string
    fingerprint?: string
    // File protocol: distinguishes plain files from inline images
    messageType?: 'file' | 'image'
}

let peer: Peer | undefined
const connectionMap: Map<string, DataConnection> = new Map<string, DataConnection>()
const peerMetadataMap: Map<string, unknown> = new Map<string, unknown>()
let incomingConnectionCallback: ((conn: DataConnection) => void) | undefined
let connectionClosedCallback: ((peerId: string) => void) | undefined
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
let reconnectTimeout: ReturnType<typeof setTimeout> | undefined

// --- Automatic data-channel reconnect --------------------------------------
// When a DataConnection closes unexpectedly (network blip, ICE failure), the
// peer is NOT removed immediately: the Redux layer is notified via
// connectionClosedCallback and dials the peer back with a fresh ECDH session.
// Explicit disconnects (disconnectPeer) and session stops suppress this.

/** Peer IDs whose close must not trigger an auto-reconnect. */
const suppressReconnect: Set<string> = new Set()
/** True while the whole peer session is being torn down. */
let sessionStopping = false
/** Which side created each connection, used by the both-sides race guard. */
const connectionDirections: WeakMap<DataConnection, 'incoming' | 'outgoing'> = new WeakMap()
/** Channels closed by the race guard; their close handlers must stay inert. */
const guardClosedConnections: WeakSet<DataConnection> = new WeakSet()

// Data handlers are registered asynchronously (after 'open'), but messages
// can arrive in the window before registration. Buffer them per peer and
// flush when the handler is attached.
const receiveCallbacks: Map<string, (f: Data) => void> = new Map<string, (f: Data) => void>()
const incomingDataBuffers: Map<string, Data[]> = new Map<string, Data[]>()

const attachBufferedDataListener = (conn: DataConnection, peerId: string) => {
    incomingDataBuffers.set(peerId, [])
    conn.on('data', (raw) => {
        const data = raw as Data
        const cb = receiveCallbacks.get(peerId)
        if (cb) {
            cb(data)
        } else {
            incomingDataBuffers.get(peerId)?.push(data)
        }
    })
}

const cleanupDataHandler = (peerId: string) => {
    receiveCallbacks.delete(peerId)
    incomingDataBuffers.delete(peerId)
}

/**
 * Shared close handler for every DataConnection (outgoing and incoming).
 * Cleanup only runs for the channel currently registered in connectionMap;
 * channels closed by the race guard (never adopted, or replaced by a newer
 * one) must not touch the state of the surviving channel. Unless the close
 * was explicit (disconnectPeer / session stop), the Redux layer is notified
 * so it can start an automatic reconnect.
 */
const handleConnectionClosed = (conn: DataConnection, peerId: string): void => {
    log.info('Connection closed: ' + peerId)
    // Channels closed by the race guard must not run cleanup or trigger a
    // reconnect (a surviving channel owns the peer state now).
    if (guardClosedConnections.has(conn)) {
        guardClosedConnections.delete(conn)
        return
    }
    if (connectionMap.get(peerId) !== conn) {
        // Never adopted or already replaced: nothing to clean up.
        return
    }
    connectionMap.delete(peerId)
    peerMetadataMap.delete(peerId)
    cleanupDataHandler(peerId)
    encryptionManager.removeSession(peerId)
    if (suppressReconnect.has(peerId)) {
        suppressReconnect.delete(peerId)
        return
    }
    if (!sessionStopping && connectionClosedCallback) {
        connectionClosedCallback(peerId)
    }
}

/** Close a channel that lost the both-sides race. */
const closeDuplicate = (conn: DataConnection): void => {
    log.info('Closing duplicate data channel to peer: ' + conn.peer)
    guardClosedConnections.add(conn)
    try {
        conn.close()
    } catch (err) {
        log.warn('Failed to close duplicate data channel', err)
    }
}

/**
 * Both-sides race (glare) guard: when both peers dial simultaneously, two
 * DataConnections can form for one peerId. Both sides must converge on the
 * SAME physical channel, otherwise each ends up keeping a channel whose
 * remote end was closed. Deterministic tiebreak: keep the channel dialed by
 * the peer with the smaller ID — the smaller-ID side keeps its outgoing
 * connection, the larger-ID side keeps the matching incoming one.
 *
 * Returns:
 * - 'adopted': `conn` is the first channel for this peer — register it.
 * - 'replaced': `conn` wins over a channel that was already open (the loser
 *   was closed here) — register it, but do NOT notify the app: a connect /
 *   reconnect flow already owns this peer, so no request dialog is wanted.
 * - 'rejected': `conn` lost the race and was closed — ignore it.
 */
const tryAdoptConnection = (conn: DataConnection, peerId: string): 'adopted' | 'replaced' | 'rejected' => {
    const existing = connectionMap.get(peerId)
    if (!existing || existing === conn) {
        return 'adopted'
    }
    if (!existing.open) {
        // Half-open channel: the newly opened one supersedes it.
        connectionMap.delete(peerId)
        closeDuplicate(existing)
        return 'replaced'
    }
    const myId = peer?.id
    if (!myId) {
        closeDuplicate(conn)
        return 'rejected'
    }
    const winnerDialer = myId < peerId ? myId : peerId
    const existingDialer = connectionDirections.get(existing) === 'outgoing' ? myId : peerId
    if (existingDialer === winnerDialer) {
        closeDuplicate(conn)
        return 'rejected'
    }
    // The newcomer is dialed by the winner: replace the existing channel.
    // Remove it from the map first so its close handler does not run cleanup.
    connectionMap.delete(peerId)
    closeDuplicate(existing)
    return 'replaced'
}

/**
 * PFS: after a connection opens, announce our ephemeral ECDH public key
 * (already attached to the connection metadata) so the responder can derive
 * the shared session key. The responder replies with its own ephemeral
 * public key; PeerJS only forwards the initiator's metadata, so this message
 * is the responder's only channel back to the initiator.
 */
const announceEphemeralKey = async (peerId: string): Promise<void> => {
    const ephemeralKey = encryptionManager.getEphemeralPublicKeyBase64(peerId)
    if (!ephemeralKey) return
    try {
        await PeerConnection.sendConnection(peerId, {
            dataType: DataType.KEY_EXCHANGE,
            ephemeralKey,
            fingerprint: encryptionManager.getFingerprint(),
        })
        log.debug('Announced ephemeral key to peer: ' + peerId)
    } catch (err) {
        log.warn('Failed to announce ephemeral key to peer: ' + peerId, err)
    }
}

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 30000

// ICE server configuration for NAT traversal
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
]

export const PeerConnection = {
    getPeer: () => peer,
    getConnectionMap: () => connectionMap,
    getPeerMetadata: (id: string) => peerMetadataMap.get(id),

    startPeerSession: () => new Promise<string>((resolve, reject) => {
        log.info('Starting peer session')
        reconnectAttempts = 0
        try {
            peer = new Peer({
                config: {
                    iceServers: ICE_SERVERS,
                    iceTransportPolicy: 'all',
                },
                debug: 1,
            })
            peer.on('open', (id) => {
                log.debug('Peer session started with ID: ' + id)
                reconnectAttempts = 0
                resolve(id)
            }).on('error', (err) => {
                log.error('Peer session error', err)
                reject(err)
            }).on('disconnected', () => {
                log.warn('Disconnected from signaling server')
                // Attempt to reconnect
                if (peer && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000)
                    log.info(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`)
                    if (reconnectTimeout) clearTimeout(reconnectTimeout)
                    reconnectTimeout = setTimeout(() => {
                        if (peer && !peer.destroyed) {
                            try {
                                peer.reconnect()
                            } catch (e) {
                                log.error('Reconnect failed', e)
                            }
                        }
                    }, delay)
                } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    log.error('Max reconnect attempts reached')
                }
            }).on('close', () => {
                log.info('Peer connection closed')
                if (reconnectTimeout) {
                    clearTimeout(reconnectTimeout)
                    reconnectTimeout = undefined
                }
            })

            // Set up incoming connection handler
            peer.on('connection', (conn) => {
                log.info('Incoming connection: ' + conn.peer)
                const peerId = conn.peer
                connectionDirections.set(conn, 'incoming')

                // Start buffering data immediately: the KEY_EXCHANGE message
                // may arrive before the async handler registration below.
                attachBufferedDataListener(conn, peerId)

                const handleOpen = () => {
                    log.debug('Incoming connection opened: ' + peerId)
                    const outcome = tryAdoptConnection(conn, peerId)
                    if (outcome === 'rejected') {
                        // Duplicate closed by the race guard: never notify the app.
                        return
                    }
                    connectionMap.set(peerId, conn)
                    peerMetadataMap.set(peerId, conn.metadata)
                    if (outcome === 'adopted' && incomingConnectionCallback) {
                        incomingConnectionCallback(conn)
                    }
                    // 'replaced': this channel superseded another one that a
                    // connect/reconnect flow already owns, so no new request.
                }

                // Check if connection is already open (PeerJS may fire 'connection' after 'open')
                if (conn.open) {
                    log.debug('Connection already open for peer: ' + peerId)
                    handleOpen()
                } else {
                    conn.on('open', handleOpen)
                }

                conn.on('error', (err) => {
                    log.error('Incoming connection error: ' + peerId, err)
                })

                conn.on('close', () => {
                    handleConnectionClosed(conn, peerId)
                })
            })
        } catch (err) {
            log.error('Failed to start peer session', err)
            reject(err)
        }
    }),

    closePeerSession: () => new Promise<void>((resolve, reject) => {
        log.info('Closing peer session')
        try {
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout)
                reconnectTimeout = undefined
            }
            reconnectAttempts = 0
            if (peer) {
                // Closing every channel fires 'close' on each of them; the
                // flag keeps those from triggering auto-reconnects.
                sessionStopping = true
                // Close all connections
                connectionMap.forEach((conn) => {
                    conn.close()
                })
                connectionMap.clear()
                peerMetadataMap.clear()
                receiveCallbacks.clear()
                incomingDataBuffers.clear()
                peer.destroy()
                peer = undefined
                sessionStopping = false
                suppressReconnect.clear()
            }
            // Always drop per-peer key material (sessions + ephemeral pairs)
            // when the session stops, even if peer was already destroyed.
            encryptionManager.clearAllSessions()
            resolve()
        } catch (err) {
            log.error('Failed to close peer session', err)
            reject(err)
        }
    }),

    connectPeer: (id: string, metadata?: unknown): Promise<void> => {
        log.info('Connecting to peer: ' + id)
        // PFS: generate a per-connection ephemeral ECDH key pair and attach
        // the public half to the connection metadata. The private half stays
        // local; both sides derive the session key from the two public halves,
        // so no session key ever travels over the wire. Key generation is
        // async, so the actual connect happens after it resolves.
        return (async () => {
            if (!peer) {
                log.error('Cannot connect: peer session not started')
                throw new Error("Peer doesn't start yet")
            }
            if (connectionMap.has(id)) {
                log.warn('Connection already exists for peer: ' + id)
                throw new Error("Connection existed")
            }

            let effectiveMetadata = metadata
            if (metadata && encryptionManager.isReady()) {
                try {
                    const ephemeralKey = await encryptionManager.createEphemeralKeyPair(id)
                    effectiveMetadata = { ...(metadata as object), ephemeralKey }
                } catch (err) {
                    log.warn('Could not attach ephemeral key metadata', err)
                }
            }

            // Capture the live Peer instance for the connect phase below.
            const peerInstance = peer

            return new Promise<void>((resolve, reject) => {
                let resolved = false
                let timeoutId: ReturnType<typeof setTimeout> | undefined

                const handlePeerError = (err: PeerError<`${PeerErrorType}`>) => {
                    if (resolved) return
                    if (err.type === 'peer-unavailable') {
                        const messageSplit = err.message.split(' ')
                        const peerId = messageSplit[messageSplit.length - 1]
                        if (id === peerId) {
                            resolved = true
                            if (timeoutId) clearTimeout(timeoutId)
                            log.error('Peer unavailable: ' + peerId)
                            // Only drop key material when no other channel for
                            // this peer is live (the peer's own dial may have
                            // won the both-sides race).
                            if (!connectionMap.has(id)) {
                                peerMetadataMap.delete(id)
                                encryptionManager.removeSession(id)
                            }
                            peer?.removeListener('error', handlePeerError)
                            reject(err)
                        }
                    }
                }

                const cleanupPeerErrorListener = () => {
                    peer?.removeListener('error', handlePeerError)
                }

                try {
                    const conn = peerInstance.connect(id, { reliable: true, metadata: effectiveMetadata })
                    if (!conn) {
                        log.error('Failed to create connection to peer: ' + id)
                        reject(new Error("Connection can't be established"))
                        return
                    }
                    connectionDirections.set(conn, 'outgoing')

                    // Buffer early data before the handler is registered after open
                    attachBufferedDataListener(conn, id)

                    // Set up timeout
                    timeoutId = setTimeout(() => {
                        if (!resolved) {
                            resolved = true
                            log.warn('Connection timeout for peer: ' + id)
                            // Clean up the half-open connection and its error
                            // listener, but never clobber a live channel that
                            // won the both-sides race.
                            if (!connectionMap.has(id)) {
                                peerMetadataMap.delete(id)
                                encryptionManager.removeSession(id)
                            }
                            cleanupPeerErrorListener()
                            try {
                                conn.close()
                            } catch (e) {
                                log.warn('Failed to close timed-out connection', e)
                            }
                            reject(new Error("Connection timeout"))
                        }
                    }, CONNECTION_TIMEOUT)

                    conn.on('open', function () {
                        if (resolved) return
                        resolved = true
                        if (timeoutId) clearTimeout(timeoutId)

                        log.debug('Successfully connected to peer: ' + id)
                        const outcome = tryAdoptConnection(conn, id)
                        if (outcome !== 'rejected') {
                            connectionMap.set(id, conn)
                            // On the initiator side conn.metadata is the metadata we
                            // passed (PeerJS only forwards the initiator's metadata
                            // to the responder), so this map never holds the peer's.
                            // Store it without `publicKey` when ECDH is active so the
                            // legacy RSA KEY_EXCHANGE block (which could only ever
                            // wrap a session key in our own public key) is skipped —
                            // no session key travels over the wire.
                            const connMetadata = conn.metadata as { ephemeralKey?: string } | undefined
                            peerMetadataMap.set(
                                id,
                                connMetadata?.ephemeralKey ? { ephemeralKey: connMetadata.ephemeralKey } : conn.metadata,
                            )
                        } else {
                            // Our dial lost the both-sides race: the channel kept is
                            // the one the peer opened. Announce our ephemeral key
                            // over it (below) so the session derives on the survivor.
                            log.info('Duplicate dial closed, keeping peer channel: ' + id)
                        }
                        peer?.removeListener('error', handlePeerError)
                        // Announce our ephemeral public key so the responder can
                        // derive the shared session key via ECDH. When our dial was
                        // closed as a duplicate this still goes over the kept channel.
                        void announceEphemeralKey(id)
                        resolve()
                    })

                    conn.on('error', function (err) {
                        if (resolved) return
                        resolved = true
                        if (timeoutId) clearTimeout(timeoutId)

                        log.error('Connection error for peer: ' + id, err)
                        // Same race guard as above: a live peer channel must
                        // not lose its metadata or session key.
                        if (!connectionMap.has(id)) {
                            peerMetadataMap.delete(id)
                            encryptionManager.removeSession(id)
                        }
                        peer?.removeListener('error', handlePeerError)
                        reject(err)
                    })

                    conn.on('close', function () {
                        handleConnectionClosed(conn, id)
                    })

                    peerInstance.on('error', handlePeerError);

                } catch (err) {
                    if (!resolved) {
                        resolved = true
                        if (timeoutId) clearTimeout(timeoutId)
                        log.error('Failed to connect to peer: ' + id, err)
                        reject(err)
                    }
                }
            })
        })()
    },

    onIncomingConnection: (callback: (conn: DataConnection) => void) => {
        log.info('Registering incoming connection handler')
        incomingConnectionCallback = callback
    },

    onConnectionClosed: (callback: (peerId: string) => void) => {
        log.info('Registering data-channel close handler')
        connectionClosedCallback = callback
    },

    onConnectionDisconnected: (id: string, callback: () => void) => {
        if (!connectionMap.has(id)) {
            return
        }
        const conn = connectionMap.get(id)
        if (conn) {
            conn.on('close', function () {
                log.info('Connection closed: ' + id)
                // A channel closed by the race guard (replaced by the peer's
                // own channel) must not run the disconnect callback: the
                // surviving channel still owns the peer.
                if (guardClosedConnections.has(conn)) {
                    guardClosedConnections.delete(conn)
                    return
                }
                // Only remove the entry if it still refers to this channel
                // (a newer one may have replaced it via the race guard).
                if (connectionMap.get(id) === conn) {
                    connectionMap.delete(id)
                }
                callback()
            })
        }
    },

    sendConnection: (id: string, data: Data): Promise<void> => new Promise((resolve, reject) => {
        log.debug('Sending data to peer: ' + id + ', type: ' + data.dataType)
        if (!connectionMap.has(id)) {
            log.error('Cannot send: connection not found for peer: ' + id)
            reject(new Error("Connection didn't exist"))
            return
        }
        try {
            const conn = connectionMap.get(id)
            if (conn) {
                if (!conn.open) {
                    log.error('Cannot send: connection not open for peer: ' + id)
                    reject(new Error("Connection not open"))
                    return
                }
                conn.send(data)
                log.debug('Data sent successfully to peer: ' + id + ', type: ' + data.dataType)
                resolve()
            } else {
                reject(new Error("Connection not found"))
            }
        } catch (err) {
            log.error('Failed to send data to peer: ' + id, err)
            reject(err)
        }
    }),

    onConnectionReceiveData: (id: string, callback: (f: Data) => void) => {
        log.debug('Setting up data handler for peer: ' + id)
        if (!connectionMap.has(id)) {
            log.warn('Cannot set up data handler: connection not found for peer: ' + id)
            return
        }
        const conn = connectionMap.get(id)
        if (conn) {
            // Register the callback and flush anything buffered before it
            receiveCallbacks.set(id, callback)
            const buffered = incomingDataBuffers.get(id)
            if (buffered) {
                incomingDataBuffers.delete(id)
                buffered.forEach((data) => callback(data))
            }
            log.debug('Data handler registered for peer: ' + id)
        }
    },

    disconnectPeer: (id: string) => {
        log.info('Disconnecting peer: ' + id)
        if (connectionMap.has(id)) {
            const conn = connectionMap.get(id)
            if (conn) {
                // The close event fires synchronously; the suppression entry
                // is consumed by handleConnectionClosed.
                suppressReconnect.add(id)
                try {
                    conn.close()
                } catch (err) {
                    suppressReconnect.delete(id)
                    log.warn('Failed to close connection for peer: ' + id, err)
                }
            }
            connectionMap.delete(id)
        }
        peerMetadataMap.delete(id)
        cleanupDataHandler(id)
    },

    isConnected: (id: string): boolean => {
        return connectionMap.has(id)
    },

    getConnectedPeers: (): string[] => {
        return Array.from(connectionMap.keys())
    }
}
