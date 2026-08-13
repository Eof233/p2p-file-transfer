export enum ConnectionActionType {
    CONNECTION_INPUT_CHANGE = 'CONNECTION_INPUT_CHANGE',
    CONNECTION_CONNECT_LOADING = 'CONNECTION_CONNECT_LOADING',
    CONNECTION_LIST_ADD = 'CONNECTION_LIST_ADD',
    CONNECTION_LIST_REMOVE = 'CONNECTION_LIST_REMOVE',
    CONNECTION_ITEM_SELECT = 'CONNECTION_ITEM_SELECT',
    CONNECTION_ERROR = 'CONNECTION_ERROR',
    CONNECTION_RESET = 'CONNECTION_RESET',
    CONNECTION_HISTORY_ADD = 'CONNECTION_HISTORY_ADD',
    CONNECTION_HISTORY_LOAD = 'CONNECTION_HISTORY_LOAD',
}

export interface ConnectionState {
    readonly id?: string
    readonly loading: boolean
    readonly list: string[]
    readonly selectedId?: string
    readonly error?: string
    /** Recent peer IDs, most recent first (localStorage-backed). */
    readonly history: string[]
}
