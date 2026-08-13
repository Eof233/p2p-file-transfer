export interface ConnectionRequest {
    readonly peerId: string
    readonly timestamp: number
    readonly status: 'pending' | 'accepted' | 'rejected'
    readonly fingerprint?: string  // remote peer's RSA key fingerprint, when available
}

export enum ConnectionRequestActionType {
    CONNECTION_REQUEST_ADD = 'CONNECTION_REQUEST_ADD',
    CONNECTION_REQUEST_ACCEPT = 'CONNECTION_REQUEST_ACCEPT',
    CONNECTION_REQUEST_REJECT = 'CONNECTION_REQUEST_REJECT',
    CONNECTION_REQUEST_REMOVE = 'CONNECTION_REQUEST_REMOVE',
    CONNECTION_REQUEST_CLEAR = 'CONNECTION_REQUEST_CLEAR',
}

export interface ConnectionRequestState {
    readonly requests: ConnectionRequest[]
}
