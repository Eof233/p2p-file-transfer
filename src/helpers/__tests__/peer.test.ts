import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Listener = (...args: any[]) => void

// vi.mock is hoisted above the imports, so the PeerJS fakes must be too.
const { FakeDataConnection, FakePeer, fakePeers } = vi.hoisted(() => {
    class FakeEmitter {
        private listeners: Map<string, Listener[]> = new Map()

        on(event: string, listener: Listener): this {
            this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
            return this
        }

        removeListener(event: string, listener: Listener): this {
            this.listeners.set(event, (this.listeners.get(event) ?? []).filter((l) => l !== listener))
            return this
        }

        emit(event: string, ...args: any[]): void {
            ;(this.listeners.get(event) ?? []).forEach((listener) => listener(...args))
        }
    }

    /** Mirrors PeerJS: close() emits 'close' synchronously on an open channel. */
    class FakeDataConnection extends FakeEmitter {
        open = false
        metadata: unknown

        constructor(public peer: string, metadata?: unknown) {
            super()
            this.metadata = metadata
        }

        send(): void {}

        simulateOpen(): void {
            this.open = true
            this.emit('open')
        }

        close(): void {
            if (!this.open) return
            this.open = false
            this.emit('close')
        }
    }

    const fakePeers: FakePeer[] = []

    class FakePeer extends FakeEmitter {
        id: string | undefined
        destroyed = false
        outgoing: FakeDataConnection[] = []

        constructor() {
            super()
            fakePeers.push(this)
        }

        connect(id: string, options?: { metadata?: unknown }): FakeDataConnection {
            const conn = new FakeDataConnection(id, options?.metadata)
            this.outgoing.push(conn)
            return conn
        }

        reconnect(): void {}

        destroy(): void {
            this.destroyed = true
        }
    }

    return { FakeDataConnection, FakePeer, fakePeers }
})

type FakeDataConnection = InstanceType<typeof FakeDataConnection>
type FakePeer = InstanceType<typeof FakePeer>

vi.mock('peerjs', () => ({ default: FakePeer }))

import { PeerConnection } from '../peer'

const startSession = async (myId: string): Promise<FakePeer> => {
    const started = PeerConnection.startPeerSession()
    const fakePeer = fakePeers[fakePeers.length - 1]
    fakePeer.id = myId
    fakePeer.emit('open', myId)
    await started
    return fakePeer
}

/** Dial `remoteId` and open the resulting outgoing channel. */
const dial = async (fakePeer: FakePeer, remoteId: string): Promise<FakeDataConnection> => {
    const connecting = PeerConnection.connectPeer(remoteId)
    await vi.waitFor(() => expect(fakePeer.outgoing.length).toBeGreaterThan(0))
    const conn = fakePeer.outgoing[fakePeer.outgoing.length - 1]
    conn.simulateOpen()
    await connecting
    return conn
}

/** Simulate the remote side dialing us and the channel opening. */
const acceptIncoming = (fakePeer: FakePeer, remoteId: string): FakeDataConnection => {
    const conn = new FakeDataConnection(remoteId)
    fakePeer.emit('connection', conn)
    conn.simulateOpen()
    return conn
}

describe('PeerConnection both-sides race guard', () => {
    const closedCallback = vi.fn()

    beforeEach(() => {
        closedCallback.mockReset()
        PeerConnection.onConnectionClosed(closedCallback)
    })

    afterEach(async () => {
        await PeerConnection.closePeerSession()
    })

    it('keeps every close handler of a replaced channel inert', async () => {
        // 'a' < 'b': the channel dialed by 'a' wins, so our outgoing one loses.
        const fakePeer = await startSession('b')
        const outgoing = await dial(fakePeer, 'a')
        const disconnected = vi.fn()
        PeerConnection.onConnectionDisconnected('a', disconnected)

        const incoming = acceptIncoming(fakePeer, 'a')

        expect(outgoing.open).toBe(false)
        expect(PeerConnection.getConnectionMap().get('a')).toBe(incoming)
        // The surviving channel owns the peer: no cleanup, no auto-reconnect.
        expect(disconnected).not.toHaveBeenCalled()
        expect(closedCallback).not.toHaveBeenCalled()
        expect(PeerConnection.isRaceGuardClosed(outgoing as any)).toBe(true)
        expect(PeerConnection.isRaceGuardClosed(incoming as any)).toBe(false)
    })

    it('still runs the disconnect cleanup when the surviving channel closes', async () => {
        const fakePeer = await startSession('b')
        await dial(fakePeer, 'a')
        const incoming = acceptIncoming(fakePeer, 'a')
        const disconnected = vi.fn()
        PeerConnection.onConnectionDisconnected('a', disconnected)

        incoming.close()

        expect(disconnected).toHaveBeenCalledTimes(1)
        expect(closedCallback).toHaveBeenCalledWith('a')
        expect(PeerConnection.isConnected('a')).toBe(false)
    })

    it('marks a rejected duplicate dial as guard-closed', async () => {
        // 'a' < 'b': our outgoing channel wins, the peer's incoming one loses.
        const fakePeer = await startSession('a')
        const outgoing = await dial(fakePeer, 'b')
        const incomingCallback = vi.fn()
        PeerConnection.onIncomingConnection(incomingCallback)

        const incoming = acceptIncoming(fakePeer, 'b')

        expect(incoming.open).toBe(false)
        expect(incomingCallback).not.toHaveBeenCalled()
        expect(PeerConnection.getConnectionMap().get('b')).toBe(outgoing)
        expect(PeerConnection.isRaceGuardClosed(incoming as any)).toBe(true)
        expect(closedCallback).not.toHaveBeenCalled()
    })
})
