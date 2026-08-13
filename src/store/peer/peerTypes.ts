export enum PeerActionType {
    PEER_SESSION_START = 'PEER_SESSION_START',
    PEER_SESSION_STOP = 'PEER_SESSION_STOP',
    PEER_LOADING = 'PEER_LOADING',
    PEER_ERROR = 'PEER_ERROR',
}

export interface PeerState {
    readonly id?: string
    readonly loading: boolean
    readonly started: boolean
    readonly error?: string
}
