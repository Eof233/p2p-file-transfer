import Peer, { DataConnection, PeerErrorType, PeerError } from "peerjs";

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

export const PeerConnection = {
    getPeer: () => peer,
    getConnectionMap: () => connectionMap,

    startPeerSession: () => new Promise<string>((resolve, reject) => {
        try {
            peer = new Peer()
            peer.on('open', (id) => {
                console.log('My ID: ' + id)
                resolve(id)
            }).on('error', (err) => {
                console.log(err)
                reject(err)
            })

            // Set up incoming connection handler
            peer.on('connection', (conn) => {
                console.log("Incoming connection: " + conn.peer)
                connectionMap.set(conn.peer, conn)
                if (incomingConnectionCallback) {
                    incomingConnectionCallback(conn)
                }
            })
        } catch (err) {
            console.log(err)
            reject(err)
        }
    }),

    closePeerSession: () => new Promise<void>((resolve, reject) => {
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
            console.log(err)
            reject(err)
        }
    }),

    connectPeer: (id: string) => new Promise<void>((resolve, reject) => {
        if (!peer) {
            reject(new Error("Peer doesn't start yet"))
            return
        }
        if (connectionMap.has(id)) {
            reject(new Error("Connection existed"))
            return
        }
        try {
            let conn = peer.connect(id, { reliable: true })
            if (!conn) {
                reject(new Error("Connection can't be established"))
            } else {
                conn.on('open', function () {
                    console.log("Connect to: " + id)
                    connectionMap.set(id, conn)
                    peer?.removeListener('error', handlePeerError)
                    resolve()
                }).on('error', function (err) {
                    console.log(err)
                    peer?.removeListener('error', handlePeerError)
                    reject(err)
                })

                const handlePeerError = (err: PeerError<`${PeerErrorType}`>) => {
                    if (err.type === 'peer-unavailable') {
                        const messageSplit = err.message.split(' ')
                        const peerId = messageSplit[messageSplit.length - 1]
                        if (id === peerId) reject(err)
                    }
                }
                peer.on('error', handlePeerError);
            }
        } catch (err) {
            reject(err)
        }
    }),

    onIncomingConnection: (callback: (conn: DataConnection) => void) => {
        incomingConnectionCallback = callback
    },

    onConnectionDisconnected: (id: string, callback: () => void) => {
        if (!connectionMap.has(id)) {
            return
        }
        let conn = connectionMap.get(id)
        if (conn) {
            conn.on('close', function () {
                console.log("Connection closed: " + id)
                connectionMap.delete(id)
                callback()
            })
        }
    },

    sendConnection: (id: string, data: Data): Promise<void> => new Promise((resolve, reject) => {
        if (!connectionMap.has(id)) {
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
                console.log("Receiving data from " + id)
                let data = receivedData as Data
                callback(data)
            })
        }
    },

    disconnectPeer: (id: string) => {
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
