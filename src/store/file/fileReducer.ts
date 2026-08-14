import {Reducer} from "redux";
import {FileActionType, FileState} from "./fileTypes";

export const initialState: FileState = {
    transfers: {},
    pendingFiles: []
}

export const FileReducer: Reducer<FileState> = (state = initialState, action) => {
    switch (action.type) {
        case FileActionType.FILE_TRANSFER_START: {
            const {id, fileName, fileSize, fileType, peerId, direction, progress, status} = action
            const transfer = {id, fileName, fileSize, fileType, peerId, direction, progress, status}
            return {...state, transfers: {...state.transfers, [id]: transfer}}
        }
        case FileActionType.FILE_TRANSFER_PROGRESS: {
            const {id, progress, speed} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, progress, speed}
                }
            }
        }
        case FileActionType.FILE_TRANSFER_COMPLETE: {
            const {id, blob} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, status: 'completed', progress: 100, blob}
                }
            }
        }
        case FileActionType.FILE_TRANSFER_CANCEL: {
            const {id} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, status: 'cancelled'}
                }
            }
        }
        case FileActionType.FILE_TRANSFER_ACCEPT: {
            const {id} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, status: 'transferring', progress: 0}
                }
            }
        }
        case FileActionType.FILE_TRANSFER_PAUSE: {
            const {id} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, paused: true}
                }
            }
        }
        case FileActionType.FILE_TRANSFER_RESUME: {
            const {id} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, paused: false, interrupted: false}
                }
            }
        }
        case FileActionType.FILE_TRANSFER_INTERRUPT: {
            const {id} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, interrupted: true}
                }
            }
        }
        case FileActionType.FILE_TRANSFER_ERROR: {
            const {id, error} = action
            const existing = state.transfers[id]
            if (!existing) return state
            return {
                ...state,
                transfers: {
                    ...state.transfers,
                    [id]: {...existing, status: 'error', error}
                }
            }
        }
        case FileActionType.FILE_PENDING_ADD: {
            const {id, fileName, fileSize, fileType, peerId, blob} = action
            const pending = {id, fileName, fileSize, fileType, peerId, blob}
            return {...state, pendingFiles: [...state.pendingFiles, pending]}
        }
        case FileActionType.FILE_PENDING_REMOVE: {
            const {id} = action
            return {...state, pendingFiles: state.pendingFiles.filter(f => f.id !== id)}
        }
        case FileActionType.FILE_RESET: {
            return {...initialState}
        }
        default:
            return state
    }
}
