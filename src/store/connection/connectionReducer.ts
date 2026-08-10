import { Reducer } from "redux";
import { ConnectionActionType, ConnectionState } from "./connectionTypes";

export const initialState: ConnectionState = {
    id: undefined,
    loading: false,
    list: [],
    selectedId: undefined,
    error: undefined,
}

export const ConnectionReducer: Reducer<ConnectionState> = (state = initialState, action) => {
    switch (action.type) {
        case ConnectionActionType.CONNECTION_INPUT_CHANGE:
            return { ...state, id: action.id }

        case ConnectionActionType.CONNECTION_CONNECT_LOADING:
            return { ...state, loading: action.loading }

        case ConnectionActionType.CONNECTION_LIST_ADD: {
            const newList = [...state.list, action.id]
            if (newList.length === 1) {
                return { ...state, list: newList, selectedId: action.id, error: undefined }
            }
            return { ...state, list: newList, error: undefined }
        }

        case ConnectionActionType.CONNECTION_LIST_REMOVE: {
            const newList = state.list.filter(e => e !== action.id)
            if (state.selectedId && !newList.includes(state.selectedId)) {
                if (newList.length === 0) {
                    return { ...state, list: newList, selectedId: undefined }
                } else {
                    return { ...state, list: newList, selectedId: newList[0] }
                }
            }
            return { ...state, list: newList }
        }

        case ConnectionActionType.CONNECTION_ITEM_SELECT:
            return { ...state, selectedId: action.id }

        case ConnectionActionType.CONNECTION_ERROR:
            return { ...state, error: action.error }

        default:
            return state
    }
}
