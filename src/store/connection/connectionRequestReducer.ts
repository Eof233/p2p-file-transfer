import { Reducer } from "redux";
import { ConnectionRequestActionType, ConnectionRequestState, ConnectionRequest } from "./connectionRequestTypes";

export const initialState: ConnectionRequestState = {
    requests: []
}

export const ConnectionRequestReducer: Reducer<ConnectionRequestState> = (state = initialState, action) => {
    if (action.type === ConnectionRequestActionType.CONNECTION_REQUEST_ADD) {
        const request: ConnectionRequest = {
            peerId: action.peerId,
            timestamp: action.timestamp,
            status: 'pending',
            fingerprint: action.fingerprint,
        }
        return { ...state, requests: [...state.requests, request] }
    } else if (action.type === ConnectionRequestActionType.CONNECTION_REQUEST_ACCEPT) {
        return {
            ...state,
            requests: state.requests.map(r =>
                r.peerId === action.peerId ? { ...r, status: 'accepted' as const } : r
            )
        }
    } else if (action.type === ConnectionRequestActionType.CONNECTION_REQUEST_REJECT) {
        return {
            ...state,
            requests: state.requests.map(r =>
                r.peerId === action.peerId ? { ...r, status: 'rejected' as const } : r
            )
        }
    } else if (action.type === ConnectionRequestActionType.CONNECTION_REQUEST_REMOVE) {
        return {
            ...state,
            requests: state.requests.filter(r => r.peerId !== action.peerId)
        }
    } else if (action.type === ConnectionRequestActionType.CONNECTION_REQUEST_CLEAR) {
        return {
            ...state,
            requests: state.requests.filter(r => r.status === 'pending')
        }
    } else {
        return state
    }
}
