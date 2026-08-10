import Peer, { DataConnection, PeerErrorType, PeerError } from "peerjs";
import { createLogger } from '../services/logService'

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
    file?: Blob
    fileName?: string
    fileType?: string
    fileSize?: number
    message?: string
    imageData?: string
    transferId?: string
    chunkIndex?: number
    totalChunks?: number
    encrypted?: boolean
    keyData?: string
}

let peer: Peer | undefined
let connectionMap: Map<string, DataConnection> = new Map<string, DataConnection>()
let incomingConnectionCallback: ((conn: DataConnection) => void) | undefined

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 15000

export const PeerConnection = {
    getPeer: () => peer,
    getConnectionMap: () => connectionMap,

    startPeerSession: () => new Promise<string>((resolve, reject) => {
        log.info('Starting peer session')
        try {
            peer = new Peer()
            peer.on('open', (id) => {
                log.debug('Peer session started with ID: ' + id)
                resolve(id)
            }).on('error', (err) => {
                log.error('Peer session error', err)
                reject(err)
            })

            // Set up incoming connection handler
            peer.on('connection', (conn) => {
                log.info('Incoming connection: ' + conn.peer)

                // Wait for the connection to open before adding to map
                const peerId = conn.peer

                conn.on('open', () => {
                    log.debug('Incoming connection opened: ' + peerId)
                    connectionMap.set(peerId, conn)
                    if (incomingConnectionCallback) {
                        incomingConnectionCallback(conn)
                    }
                })

                conn.on('error', (err) => {
                    log.error('Incoming connection error: ' + peerId, err)
                })

                conn.on('close', () => {
                    log.info('Incoming connection closed: ' + peerId)
                    connectionMap.delete(peerId)
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
            if (peer) {
                // Close all connections
                connectionMap.forEach((conn) => {
                    conn.close()
                })
                connectionMap.clear()
                peer.destroy()
                peer = undefined
            }
            resolve()
        } catch (err) {
            log.error('Failed to close peer session', err)
            reject(err)
        }
    }),

    connectPeer: (id: string) => new Promise<void>((resolve, reject) => {
        log.info('Connecting to peer: ' + id)
        if (!peer) {
            log.error('Cannot connect: peer session not started')
            reject(new Error("Peer doesn't start yet"))
            return
        }
        if (connectionMap.has(id)) {
            log.warn('Connection already exists for peer: ' + id)
            reject(new Error("Connection existed"))
            return
        }

        let resolved = false
        let timeoutId: ReturnType<typeof setTimeout> | undefined

        try {
            let conn = peer.connect(id, { reliable: true })
            if (!conn) {
                log.error('Failed to create connection to peer: ' + id)
                reject(new Error("Connection can't be established"))
                return
            }

            // Set up timeout
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true
                    log.warn('Connection timeout for peer: ' + id)
                    // Clean up the connection if it's still pending
                    if (connectionMap.has(id)) {
                        connectionMap.delete(id)
                    }
                    reject(new Error("Connection timeout"))
                }
            }, CONNECTION_TIMEOUT)

            conn.on('open', function () {
                if (resolved) return
                resolved = true
                if (timeoutId) clearTimeout(timeoutId)

                log.debug('Successfully connected to peer: ' + id)
                connectionMap.set(id, conn)
                peer?.removeListener('error', handlePeerError)
                resolve()
            })

            conn.on('error', function (err) {
                if (resolved) return
                resolved = true
                if (timeoutId) clearTimeout(timeoutId)

                log.error('Connection error for peer: ' + id, err)
                peer?.removeListener('error', handlePeerError)
                reject(err)
            })

            conn.on('close', function () {
                log.info('Connection closed: ' + id)
                connectionMap.delete(id)
            })

            const handlePeerError = (err: PeerError<`${PeerErrorType}`>) => {
                if (resolved) return
                if (err.type === 'peer-unavailable') {
                    const messageSplit = err.message.split(' ')
                    const peerId = messageSplit[messageSplit.length - 1]
                    if (id === peerId) {
                        resolved = true
                        if (timeoutId) clearTimeout(timeoutId)
                        log.error('Peer unavailable: ' + peerId)
                        peer?.removeListener('error', handlePeerError)
                        reject(err)
                    }
                }
            }
            peer.on('error', handlePeerError);

        } catch (err) {
            if (!resolved) {
                resolved = true
                if (timeoutId) clearTimeout(timeoutId)
                log.error('Failed to connect to peer: ' + id, err)
                reject(err)
            }
        }
    }),

    onIncomingConnection: (callback: (conn: DataConnection) => void) => {
        log.info('Registering incoming connection handler')
        incomingConnectionCallback = callback
    },

    onConnectionDisconnected: (id: string, callback: () => void) => {
        if (!connectionMap.has(id)) {
            return
        }
        let conn = connectionMap.get(id)
        if (conn) {
            conn.on('close', function () {
                log.info('Connection closed: ' + id)
                connectionMap.delete(id)
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
            let conn = connectionMap.get(id)
            if (conn) {
                conn.send(data)
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
        if (!connectionMap.has(id)) {
            return
        }
        let conn = connectionMap.get(id)
        if (conn) {
            conn.on('data', function (receivedData) {
                let data = receivedData as Data
                log.debug('Received data from peer: ' + id + ', type: ' + data.dataType)
                callback(data)
            })
        }
    },

    disconnectPeer: (id: string) => {
        log.info('Disconnecting peer: ' + id)
        if (connectionMap.has(id)) {
            const conn = connectionMap.get(id)
            if (conn) {
                conn.close()
            }
            connectionMap.delete(id)
        }
    },

    isConnected: (id: string): boolean => {
        return connectionMap.has(id)
    },

    getConnectedPeers: (): string[] => {
        return Array.from(connectionMap.keys())
    }
}
