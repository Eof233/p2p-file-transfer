import { describe, it, expect } from 'vitest'
import {
    waitForAcceptance,
    resolveAcceptWaiter,
    rejectAcceptWaiter,
    waitForEndAnswer,
    answerEndWaiter,
    clearTransferState,
    clearAllTransferState,
    markTransferCancelled,
    isTransferCancelled,
    markTransferPaused,
    isTransferPaused,
    unmarkTransferPaused,
    setSenderTransferState,
    getSenderTransferState,
    interruptTransferState,
    SenderTransferState,
    pendingIncomingTransfers,
} from '../transferCoordinator'

/** Minimal sender-side state used to exercise pause/resume bookkeeping. */
const senderState = (): SenderTransferState => ({
    peerId: 'peerA',
    fileName: 'a.bin',
    fileType: 'application/octet-stream',
    chunks: [],
    pendingIndexes: [0, 1, 2],
    sentIndexes: new Set<number>([0]),
    retransmitRounds: 0,
    useEncryption: false,
    startTime: Date.now(),
    bytesSent: 1024,
    active: false,
})

describe('transferCoordinator', () => {
    it('acceptance waiter resolves on FILE_ACCEPT', async () => {
        const waiting = waitForAcceptance('t1', 500)
        resolveAcceptWaiter('t1')
        await expect(waiting).resolves.toBeUndefined()
    })

    it('acceptance waiter rejects on FILE_REJECT', async () => {
        const waiting = waitForAcceptance('t2', 500)
        rejectAcceptWaiter('t2', 'Transfer rejected by peer')
        await expect(waiting).rejects.toThrow('Transfer rejected by peer')
    })

    it('acceptance waiter rejects on timeout', async () => {
        const waiting = waitForAcceptance('t3', 100)
        await expect(waiting).rejects.toThrow('did not respond')
    })

    it('end-answer waiter resolves with the missing chunk list', async () => {
        const waiting = waitForEndAnswer('t4', 500)
        answerEndWaiter('t4', { kind: 'missing', missing: [2, 5, 9] })
        const answer = await waiting
        expect(answer.kind).toBe('missing')
        if (answer.kind === 'missing') expect(answer.missing).toEqual([2, 5, 9])
    })

    it('end-answer waiter resolves with complete', async () => {
        const waiting = waitForEndAnswer('t5', 500)
        answerEndWaiter('t5', { kind: 'complete' })
        const answer = await waiting
        expect(answer.kind).toBe('complete')
    })

    it('end-answer waiter rejects on timeout', async () => {
        const waiting = waitForEndAnswer('t6', 100)
        await expect(waiting).rejects.toThrow('did not confirm')
    })

    it('clearTransferState rejects pending waiters and clears cancel flags', async () => {
        const accept = waitForAcceptance('t7', 1000)
        const end = waitForEndAnswer('t7', 1000)
        markTransferCancelled('t7')
        expect(isTransferCancelled('t7')).toBe(true)

        clearTransferState('t7')
        await expect(accept).rejects.toThrow('Transfer aborted')
        await expect(end).rejects.toThrow('Transfer aborted')
        expect(isTransferCancelled('t7')).toBe(false)
    })

    it('clearAllTransferState rejects every waiter and clears buffers', async () => {
        pendingIncomingTransfers.set('t8', {
            chunks: new Map(),
            metadata: { fileName: 'a', fileSize: 1, fileType: 't', totalChunks: 1, chatType: 'file' },
            peerId: 'p',
            accepted: true,
            retransmitRounds: 0,
        })
        const accept = waitForAcceptance('t8', 1000)

        clearAllTransferState()
        await expect(accept).rejects.toThrow('Transfer aborted')
        expect(pendingIncomingTransfers.size).toBe(0)
    })

    it('pause flag can be set, queried and cleared', () => {
        expect(isTransferPaused('p1')).toBe(false)
        markTransferPaused('p1')
        expect(isTransferPaused('p1')).toBe(true)
        unmarkTransferPaused('p1')
        expect(isTransferPaused('p1')).toBe(false)
    })

    it('clearTransferState clears the pause flag and sender state', () => {
        markTransferPaused('p2')
        setSenderTransferState('p2', senderState())
        clearTransferState('p2')
        expect(isTransferPaused('p2')).toBe(false)
        expect(getSenderTransferState('p2')).toBeUndefined()
    })

    it('interruptTransferState keeps sender state but clears cancel flag and waiters', async () => {
        setSenderTransferState('p3', senderState())
        markTransferCancelled('p3')
        const end = waitForEndAnswer('p3', 1000)

        interruptTransferState('p3')
        expect(getSenderTransferState('p3')).toBeDefined()
        expect(isTransferCancelled('p3')).toBe(false)
        await expect(end).rejects.toThrow('Transfer interrupted')

        clearTransferState('p3')
    })

    it('clearAllTransferState clears sender state and pause flags', () => {
        setSenderTransferState('p4', senderState())
        markTransferPaused('p4')

        clearAllTransferState()
        expect(getSenderTransferState('p4')).toBeUndefined()
        expect(isTransferPaused('p4')).toBe(false)
    })
})
