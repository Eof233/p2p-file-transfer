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
    pendingIncomingTransfers,
} from '../transferCoordinator'

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
})
