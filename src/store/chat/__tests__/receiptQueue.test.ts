import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    enqueueReceipt,
    clearAllReceiptQueues,
    setReceiptSendFunction,
    receiptQueues,
} from '../receiptQueue'
import { DataType, Data, PeerConnection } from '../../../helpers/peer'

const makeData = (label: string): Data => ({ dataType: DataType.OTHER, message: label })

/** Drain the microtask queue so the queue's async flushes settle. */
const settle = async (): Promise<void> => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

describe('receiptQueue', () => {
    let sendMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        vi.useFakeTimers()
        clearAllReceiptQueues()
        sendMock = vi.fn().mockResolvedValue(undefined)
        setReceiptSendFunction(sendMock as (peerId: string, data: Data) => Promise<void>)
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })

    it('sends queued receipts in FIFO order per peer', async () => {
        enqueueReceipt('p1', 'm1', 'delivered', makeData('m1-delivered'))
        enqueueReceipt('p1', 'm2', 'read', makeData('m2-read'))
        await settle()

        expect(sendMock).toHaveBeenCalledTimes(2)
        expect(sendMock.mock.calls[0]).toEqual(['p1', makeData('m1-delivered')])
        expect(sendMock.mock.calls[1]).toEqual(['p1', makeData('m2-read')])
        expect(receiptQueues.has('p1')).toBe(false)
    })

    it('keeps per-peer queues independent', async () => {
        enqueueReceipt('p1', 'm1', 'read', makeData('p1-m1'))
        enqueueReceipt('p2', 'm2', 'read', makeData('p2-m2'))
        await settle()

        expect(sendMock).toHaveBeenCalledTimes(2)
        expect(sendMock.mock.calls.map(([peerId]) => peerId)).toEqual(['p1', 'p2'])
        expect(receiptQueues.size).toBe(0)
    })

    it("dedupes: 'read' supersedes an undelivered 'delivered' for the same message", async () => {
        sendMock.mockRejectedValueOnce(new Error('send failed'))
        enqueueReceipt('p1', 'm1', 'delivered', makeData('m1-delivered'))
        await settle()
        expect(sendMock).toHaveBeenCalledTimes(1)

        // First attempt failed: the receipt is waiting for its 1s retry.
        const waiting = receiptQueues.get('p1')!
        expect(waiting.entries).toHaveLength(1)
        expect(waiting.entries[0].retryCount).toBe(1)

        // A 'read' for the same message supersedes the queued 'delivered'.
        enqueueReceipt('p1', 'm1', 'read', makeData('m1-read'))
        expect(receiptQueues.get('p1')!.entries).toHaveLength(1)
        expect(receiptQueues.get('p1')!.entries[0].status).toBe('read')

        // The retry (1s later) sends the superseding 'read' payload.
        await vi.advanceTimersByTimeAsync(1000)
        expect(sendMock).toHaveBeenCalledTimes(2)
        expect(sendMock.mock.calls[1]).toEqual(['p1', makeData('m1-read')])
        expect(receiptQueues.has('p1')).toBe(false)
    })

    it("dedupes: a newer 'read' supersedes an older undelivered 'read', and 'delivered' never downgrades it", async () => {
        sendMock.mockRejectedValue(new Error('send failed'))
        enqueueReceipt('p1', 'm1', 'read', makeData('m1-read-v1'))
        await settle()

        // Same-rank receipt (newer 'read') replaces the queued payload.
        enqueueReceipt('p1', 'm1', 'read', makeData('m1-read-v2'))
        // Lower-rank receipt ('delivered') is ignored entirely.
        enqueueReceipt('p1', 'm1', 'delivered', makeData('m1-delivered'))

        const queue = receiptQueues.get('p1')!
        expect(queue.entries).toHaveLength(1)
        expect(queue.entries[0].status).toBe('read')
        expect(queue.entries[0].data).toEqual(makeData('m1-read-v2'))
        expect(queue.entries[0].retryCount).toBe(1)

        // The retry sends the superseding payload instead of the older one.
        await vi.advanceTimersByTimeAsync(1000)
        expect(sendMock).toHaveBeenCalledTimes(2)
        expect(sendMock.mock.calls[1]).toEqual(['p1', makeData('m1-read-v2')])
    })

    it('retries with backoff (1s, 2s, 4s) and drops after the retry budget', async () => {
        sendMock.mockRejectedValue(new Error('send failed'))
        enqueueReceipt('p1', 'm1', 'read', makeData('m1'))
        await settle()
        expect(sendMock).toHaveBeenCalledTimes(1)
        expect(receiptQueues.get('p1')!.entries[0].retryCount).toBe(1)

        // Backoff not elapsed yet -> no retry.
        await vi.advanceTimersByTimeAsync(999)
        expect(sendMock).toHaveBeenCalledTimes(1)

        // 1s retry
        await vi.advanceTimersByTimeAsync(1)
        expect(sendMock).toHaveBeenCalledTimes(2)
        expect(receiptQueues.get('p1')!.entries[0].retryCount).toBe(2)

        // 2s retry
        await vi.advanceTimersByTimeAsync(2000)
        expect(sendMock).toHaveBeenCalledTimes(3)
        expect(receiptQueues.get('p1')!.entries[0].retryCount).toBe(3)

        // 4s retry -> retry budget exhausted -> receipt dropped
        await vi.advanceTimersByTimeAsync(4000)
        expect(sendMock).toHaveBeenCalledTimes(4)
        expect(receiptQueues.has('p1')).toBe(false)

        // No timers left: nothing else is ever sent.
        await vi.advanceTimersByTimeAsync(10000)
        expect(sendMock).toHaveBeenCalledTimes(4)
    })

    it('clears the queue and its retry timer when the connection closes', async () => {
        sendMock.mockRejectedValue(new Error('send failed'))
        vi.spyOn(PeerConnection, 'isConnected').mockReturnValue(true)
        const disconnectSpy = vi.spyOn(PeerConnection, 'onConnectionDisconnected')

        enqueueReceipt('p1', 'm1', 'read', makeData('m1'))
        // A close listener is wired up so the queue drops on disconnect.
        expect(disconnectSpy).toHaveBeenCalledWith('p1', expect.any(Function))
        await settle()
        expect(sendMock).toHaveBeenCalledTimes(1)
        expect(receiptQueues.get('p1')!.entries).toHaveLength(1)

        // Simulate the data channel closing (PeerConnection invokes the hook).
        const onClose = disconnectSpy.mock.calls[0][1] as () => void
        onClose()
        expect(receiptQueues.has('p1')).toBe(false)

        // The pending retry timer was cancelled: nothing is sent afterwards.
        await vi.advanceTimersByTimeAsync(10000)
        expect(sendMock).toHaveBeenCalledTimes(1)
    })

    it('clearAllReceiptQueues drops every peer queue and cancels timers', async () => {
        sendMock.mockRejectedValue(new Error('send failed'))
        enqueueReceipt('p1', 'm1', 'read', makeData('m1'))
        enqueueReceipt('p2', 'm2', 'read', makeData('m2'))
        await settle()
        expect(receiptQueues.size).toBe(2)

        clearAllReceiptQueues()
        expect(receiptQueues.size).toBe(0)
        await vi.advanceTimersByTimeAsync(10000)
        expect(sendMock).toHaveBeenCalledTimes(2)
    })
})
