import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleSendFailure } from '../useFileTransfer'
import { PeerConnection } from '../../helpers/peer'
import { FileActionType } from '../../store/file/fileTypes'
import {
    TransferInterruptedError,
    cancelSenderTransfer,
    clearAllTransferState,
    getSenderTransferState,
    isTransferCancelled,
    setSenderTransferState,
} from '../../store/file/transferCoordinator'

const registerSenderState = (transferId: string): void => {
    setSenderTransferState(transferId, {
        peerId: 'peerA',
        fileName: 'a.bin',
        fileType: 'application/octet-stream',
        chunks: [],
        pendingIndexes: [],
        sentIndexes: new Set<number>(),
        retransmitRounds: 0,
        useEncryption: false,
        startTime: Date.now(),
        bytesSent: 0,
        active: false,
    })
}

describe('handleSendFailure', () => {
    let dispatch: ReturnType<typeof vi.fn>

    const dispatchedTypes = (): string[] => dispatch.mock.calls.map(([action]) => action.type)

    beforeEach(() => {
        dispatch = vi.fn()
        vi.spyOn(PeerConnection, 'sendConnection').mockResolvedValue(undefined)
        clearAllTransferState()
    })

    afterEach(() => {
        clearAllTransferState()
        vi.restoreAllMocks()
    })

    it('reports a cancelled transfer as cancelled even when the loop surfaced an interruption', () => {
        registerSenderState('t1')
        cancelSenderTransfer('t1')

        handleSendFailure('t1', 'peerA', new TransferInterruptedError('No completion answer'), dispatch as any, false)

        expect(dispatchedTypes()).toEqual([FileActionType.FILE_TRANSFER_CANCEL])
        // Full cleanup: nothing is kept for a resume that can never happen.
        expect(getSenderTransferState('t1')).toBeUndefined()
        expect(isTransferCancelled('t1')).toBe(false)
    })

    it('reports a cancelled transfer as cancelled when the acceptance wait fails', () => {
        cancelSenderTransfer('t2')

        handleSendFailure('t2', 'peerA', new Error('Peer did not respond to the file request'), dispatch as any, false)

        expect(dispatchedTypes()).toEqual([FileActionType.FILE_TRANSFER_CANCEL])
    })

    it('keeps an uncancelled dropped transfer resumable', () => {
        registerSenderState('t3')

        handleSendFailure('t3', 'peerA', new TransferInterruptedError('Connection lost'), dispatch as any, false)

        expect(dispatchedTypes()).toEqual([FileActionType.FILE_TRANSFER_INTERRUPT])
        expect(getSenderTransferState('t3')).toBeDefined()
    })

    it('reports any other failure as an error', () => {
        handleSendFailure('t4', 'peerA', new Error('boom'), dispatch as any, false)

        expect(dispatchedTypes()).toEqual([FileActionType.FILE_TRANSFER_ERROR])
    })
})
