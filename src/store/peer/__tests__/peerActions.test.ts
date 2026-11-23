import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Dispatch } from 'redux'

type IncomingConnection = {
    peer: string
    metadata: Record<string, unknown>
    on: (event: string, callback: () => void) => unknown
}

const fakes = vi.hoisted(() => ({
    incomingConnection: undefined as ((conn: IncomingConnection) => void) | undefined,
    isRaceGuardClosed: vi.fn(),
    removeSession: vi.fn(),
    clearReceiveQueue: vi.fn(),
}))

vi.mock('../../../helpers/peer', () => ({
    PeerConnection: {
        getPeer: vi.fn(() => undefined),
        startPeerSession: vi.fn(async () => 'me'),
        onIncomingConnection: vi.fn((callback: (conn: IncomingConnection) => void) => {
            fakes.incomingConnection = callback
        }),
        onConnectionReceiveData: vi.fn(),
        isRaceGuardClosed: fakes.isRaceGuardClosed,
    },
}))

vi.mock('../../../services/encryptionService', () => ({
    encryptionManager: {
        init: vi.fn(async () => undefined),
        removeSession: fakes.removeSession,
    },
}))

vi.mock('../../connection/receiveData', () => ({
    handleReceivedData: vi.fn(),
    clearReceiveQueue: fakes.clearReceiveQueue,
}))

vi.mock('../../connection/connectionActions', () => ({
    removeConnectionList: (peerId: string) => ({
        type: 'CONNECTION_LIST_REMOVE',
        id: peerId,
    }),
}))

vi.mock('../../connection/connectionRequestActions', () => ({
    addConnectionRequest: (peerId: string, fingerprint?: string) => ({
        type: 'CONNECTION_REQUEST_ADD',
        peerId,
        fingerprint,
    }),
    removeConnectionRequest: (peerId: string) => ({
        type: 'CONNECTION_REQUEST_REMOVE',
        peerId,
    }),
}))

vi.mock('../../../services/logService', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}))

import { startPeer } from '../peerActions'

const closeIncomingConnection = async () => {
    const dispatch = vi.fn()
    await startPeer()(dispatch as unknown as Dispatch)

    const handlers: Record<string, () => void> = {}
    const conn: IncomingConnection = {
        peer: 'B',
        metadata: {},
        on: (event, callback) => {
            handlers[event] = callback
        },
    }

    fakes.incomingConnection?.(conn)
    handlers.close?.()

    return dispatch.mock.calls.map(([action]) => action as { type: string; peerId?: string; id?: string })
}

describe('startPeer incoming connection close cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fakes.incomingConnection = undefined
        fakes.isRaceGuardClosed.mockReturnValue(false)
    })

    it('drops only the stale request when the race guard replaces the channel', async () => {
        fakes.isRaceGuardClosed.mockReturnValue(true)

        const actions = await closeIncomingConnection()

        expect(actions).toContainEqual({ type: 'CONNECTION_REQUEST_REMOVE', peerId: 'B' })
        expect(actions).not.toContainEqual({ type: 'CONNECTION_LIST_REMOVE', id: 'B' })
        expect(fakes.removeSession).not.toHaveBeenCalled()
        expect(fakes.clearReceiveQueue).not.toHaveBeenCalled()
    })

    it('cleans up the request, list entry, session, and receive queue for other closes', async () => {
        const actions = await closeIncomingConnection()

        expect(actions).toContainEqual({ type: 'CONNECTION_REQUEST_REMOVE', peerId: 'B' })
        expect(actions).toContainEqual({ type: 'CONNECTION_LIST_REMOVE', id: 'B' })
        expect(fakes.removeSession).toHaveBeenCalledWith('B')
        expect(fakes.clearReceiveQueue).toHaveBeenCalledWith('B')
    })
})
