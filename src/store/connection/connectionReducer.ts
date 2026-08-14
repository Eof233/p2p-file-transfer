import { Reducer } from "redux";
import { ConnectionActionType, ConnectionState } from "./connectionTypes";

export const initialState: ConnectionState = {
    id: undefined,
    loading: false,
    list: [],
    selectedId: undefined,
    error: undefined,
    history: [],
    reconnecting: [],
}

export const ConnectionReducer: Reducer<ConnectionState> = (state = initialState, action) => {
    switch (action.type) {
        case ConnectionActionType.CONNECTION_INPUT_CHANGE:
            return { ...state, id: action.id }

        case ConnectionActionType.CONNECTION_CONNECT_LOADING:
            return { ...state, loading: action.loading }

        case ConnectionActionType.CONNECTION_LIST_ADD: {
            // Dedupe: a peer may be re-added while already present (reconnect
            // success, accepting a request for a connected peer).
            if (state.list.includes(action.id)) {
                return { ...state, error: undefined }
            }
            const newList = [...state.list, action.id]
            if (newList.length === 1) {
                return { ...state, list: newList, selectedId: action.id, error: undefined }
            }
            return { ...state, list: newList, error: undefined }
        }

        case ConnectionActionType.CONNECTION_LIST_REMOVE: {
            // A peer that is currently being reconnected stays in the list so
            // the sidebar can show the reconnecting state; only the end of the
            // reconnect loop (or an explicit disconnect) removes it.
            const effectiveList = state.reconnecting.includes(action.id)
                ? state.list
                : state.list.filter(e => e !== action.id)
            if (state.selectedId && !effectiveList.includes(state.selectedId)) {
                if (effectiveList.length === 0) {
                    return { ...state, list: effectiveList, selectedId: undefined }
                } else {
                    return { ...state, list: effectiveList, selectedId: effectiveList[0] }
                }
            }
            return { ...state, list: effectiveList }
        }

        case ConnectionActionType.CONNECTION_ITEM_SELECT:
            return { ...state, selectedId: action.id }

        case ConnectionActionType.CONNECTION_ERROR:
            return { ...state, error: action.error }

        case ConnectionActionType.CONNECTION_HISTORY_ADD: {
            const history = [action.id, ...state.history.filter(e => e !== action.id)].slice(0, 10)
            return { ...state, history }
        }

        case ConnectionActionType.CONNECTION_HISTORY_LOAD:
            return { ...state, history: action.history }

        case ConnectionActionType.CONNECTION_RECONNECTING: {
            const reconnecting = state.reconnecting.includes(action.id)
                ? state.reconnecting
                : [...state.reconnecting, action.id]
            // The close cleanup removes the peer from the list; re-add it so
            // the sidebar keeps showing it while reconnecting.
            const list = state.list.includes(action.id) ? state.list : [...state.list, action.id]
            return { ...state, reconnecting, list }
        }

        case ConnectionActionType.CONNECTION_RECONNECTED: {
            const reconnecting = state.reconnecting.filter(e => e !== action.id)
            // Defensive: the peer stays in the list once reconnected.
            const list = state.list.includes(action.id) ? state.list : [...state.list, action.id]
            return { ...state, reconnecting, list }
        }

        case ConnectionActionType.CONNECTION_RECONNECT_FAILED: {
            const reconnecting = state.reconnecting.filter(e => e !== action.id)
            const newList = state.list.filter(e => e !== action.id)
            if (state.selectedId && !newList.includes(state.selectedId)) {
                if (newList.length === 0) {
                    return { ...state, reconnecting, list: newList, selectedId: undefined }
                } else {
                    return { ...state, reconnecting, list: newList, selectedId: newList[0] }
                }
            }
            return { ...state, reconnecting, list: newList }
        }

        case ConnectionActionType.CONNECTION_RESET:
            return { ...initialState, history: state.history }

        default:
            return state
    }
}
