import { describe, it, expect } from 'vitest'
import { FileReducer, initialState } from '../fileReducer'
import { FileActionType } from '../fileTypes'

const startTransfer = (id = 't1') => ({
    type: FileActionType.FILE_TRANSFER_START,
    id,
    fileName: 'a.bin',
    fileSize: 100,
    fileType: 'application/octet-stream',
    peerId: 'peerA',
    direction: 'send',
    progress: 0,
    status: 'pending',
})

describe('FileReducer', () => {
    it('starts a transfer in pending state', () => {
        const state = FileReducer(initialState, startTransfer())
        expect(state.transfers.t1.status).toBe('pending')
        expect(state.transfers.t1.progress).toBe(0)
    })

    it('updates progress and speed', () => {
        const state = FileReducer(initialState, startTransfer())
        const progressed = FileReducer(state, {
            type: FileActionType.FILE_TRANSFER_PROGRESS,
            id: 't1',
            progress: 42,
            speed: 1000,
        })
        expect(progressed.transfers.t1.progress).toBe(42)
        expect(progressed.transfers.t1.speed).toBe(1000)

        // unknown id is a no-op
        const noop = FileReducer(progressed, {
            type: FileActionType.FILE_TRANSFER_PROGRESS,
            id: 'ghost',
            progress: 99,
        })
        expect(noop).toEqual(progressed)
    })

    it('accept flips pending to transferring', () => {
        const state = FileReducer(initialState, startTransfer())
        const accepted = FileReducer(state, {
            type: FileActionType.FILE_TRANSFER_ACCEPT,
            id: 't1',
        })
        expect(accepted.transfers.t1.status).toBe('transferring')
        expect(accepted.transfers.t1.progress).toBe(0)
    })

    it('completes with a stored blob', () => {
        const state = FileReducer(initialState, startTransfer())
        const blob = new Blob(['x'])
        const done = FileReducer(state, {
            type: FileActionType.FILE_TRANSFER_COMPLETE,
            id: 't1',
            blob,
        })
        expect(done.transfers.t1.status).toBe('completed')
        expect(done.transfers.t1.progress).toBe(100)
        expect(done.transfers.t1.blob).toBe(blob)
    })

    it('cancels and errors', () => {
        const state = FileReducer(initialState, startTransfer())

        const cancelled = FileReducer(state, {
            type: FileActionType.FILE_TRANSFER_CANCEL,
            id: 't1',
        })
        expect(cancelled.transfers.t1.status).toBe('cancelled')

        const errored = FileReducer(state, {
            type: FileActionType.FILE_TRANSFER_ERROR,
            id: 't1',
            error: 'boom',
        })
        expect(errored.transfers.t1.status).toBe('error')
        expect(errored.transfers.t1.error).toBe('boom')
    })

    it('adds and removes pending files', () => {
        const state = FileReducer(initialState, {
            type: FileActionType.FILE_PENDING_ADD,
            id: 'p1',
            fileName: 'big.bin',
            fileSize: 10 * 1024 * 1024,
            fileType: 'application/octet-stream',
            peerId: 'peerA',
        })
        expect(state.pendingFiles).toHaveLength(1)
        expect(state.pendingFiles[0].fileName).toBe('big.bin')

        const removed = FileReducer(state, {
            type: FileActionType.FILE_PENDING_REMOVE,
            id: 'p1',
        })
        expect(removed.pendingFiles).toHaveLength(0)
    })

    it('resets to the initial state', () => {
        const state = FileReducer(initialState, startTransfer())
        const reset = FileReducer(state, { type: FileActionType.FILE_RESET })
        expect(reset).toEqual(initialState)
    })

    it('pause, interrupt and resume update the transfer flags', () => {
        const state = FileReducer(initialState, startTransfer())

        const paused = FileReducer(state, { type: FileActionType.FILE_TRANSFER_PAUSE, id: 't1' })
        expect(paused.transfers.t1.paused).toBe(true)

        const interrupted = FileReducer(paused, { type: FileActionType.FILE_TRANSFER_INTERRUPT, id: 't1' })
        expect(interrupted.transfers.t1.interrupted).toBe(true)

        const resumed = FileReducer(interrupted, { type: FileActionType.FILE_TRANSFER_RESUME, id: 't1' })
        expect(resumed.transfers.t1.paused).toBe(false)
        expect(resumed.transfers.t1.interrupted).toBe(false)
    })

    it('pause/resume/interrupt are no-ops for unknown transfers', () => {
        const paused = FileReducer(initialState, { type: FileActionType.FILE_TRANSFER_PAUSE, id: 'ghost' })
        expect(paused).toEqual(initialState)

        const interrupted = FileReducer(initialState, { type: FileActionType.FILE_TRANSFER_INTERRUPT, id: 'ghost' })
        expect(interrupted).toEqual(initialState)

        const resumed = FileReducer(initialState, { type: FileActionType.FILE_TRANSFER_RESUME, id: 'ghost' })
        expect(resumed).toEqual(initialState)
    })
})
