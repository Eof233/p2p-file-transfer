import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { startPeer, stopPeerSession } from '../store/peer/peerActions'
import * as connectionAction from '../store/connection/connectionActions'
import { createLogger } from '../services/logService'

const log = createLogger('usePeer')

export const usePeer = () => {
    const dispatch = useAppDispatch()
    const peer = useAppSelector((state) => state.peer)
    const connection = useAppSelector((state) => state.connection)

    const startSession = useCallback(() => {
        log.info('Starting peer session')
        dispatch(startPeer() as any)
    }, [dispatch])

    const stopSession = useCallback(() => {
        log.info('Stopping peer session')
        dispatch(stopPeerSession())
    }, [dispatch])

    const connectToPeer = useCallback(
        (id: string) => {
            log.info('Connecting to peer: ' + id)
            dispatch(connectionAction.connectPeer(id) as any)
        },
        [dispatch],
    )

    const selectConnection = useCallback(
        (id: string) => {
            dispatch(connectionAction.selectItem(id))
        },
        [dispatch],
    )

    const copyId = useCallback(async () => {
        if (peer.id) {
            await navigator.clipboard.writeText(peer.id)
        }
    }, [peer.id])

    return {
        ...peer,
        connections: connection.list,
        selectedConnection: connection.selectedId,
        connectLoading: connection.loading,
        startSession,
        stopSession,
        connectToPeer,
        selectConnection,
        copyId,
    }
}
