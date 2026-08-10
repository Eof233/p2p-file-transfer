import { ConnectionActionType } from "./connectionTypes";
import { Dispatch } from "redux";
import { PeerConnection } from "../../helpers/peer";
import { createLogger } from "../../services/logService";

const log = createLogger('ConnectionActions')

export const changeConnectionInput = (id: string) => ({
    type: ConnectionActionType.CONNECTION_INPUT_CHANGE, id
})

export const setLoading = (loading: boolean) => ({
    type: ConnectionActionType.CONNECTION_CONNECT_LOADING, loading
})

export const addConnectionList = (id: string) => ({
    type: ConnectionActionType.CONNECTION_LIST_ADD, id
})

export const removeConnectionList = (id: string) => ({
    type: ConnectionActionType.CONNECTION_LIST_REMOVE, id
})

export const selectItem = (id: string) => ({
    type: ConnectionActionType.CONNECTION_ITEM_SELECT, id
})

export const connectPeer: (id: string) => (dispatch: Dispatch) => Promise<void>
    = (id: string) => (async (dispatch) => {
        log.info('Connecting to peer: ' + id)
        dispatch(setLoading(true))
        try {
            await PeerConnection.connectPeer(id)
            PeerConnection.onConnectionDisconnected(id, () => {
                log.info('Connection closed: ' + id)
                dispatch(removeConnectionList(id))
            })
            PeerConnection.onConnectionReceiveData(id, (data) => {
                log.debug('Receiving data from peer: ' + id + ', type: ' + data.dataType)
                // Data handling is done in the components via hooks
            })
            log.debug('Successfully connected to peer: ' + id)
            dispatch(addConnectionList(id))
            dispatch(setLoading(false))
        } catch (err) {
            log.error('Failed to connect to peer: ' + id, err)
            dispatch(setLoading(false))
        }
    })
