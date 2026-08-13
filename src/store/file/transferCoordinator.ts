import { createLogger } from '../../services/logService'

const log = createLogger('TransferCoordinator')

/**
 * Shared, module-level state for the file transfer protocol.
 * Lives outside Redux because it holds live Blob/ciphertext buffers.
 */

export interface PendingTransfer {
    chunks: Map<number, Blob>
    metadata: {
        fileName: string
        fileSize: number
        fileType: string
        totalChunks: number
        chatType: 'file' | 'image'
    }
    peerId: string
    accepted: boolean
}

/** Incoming transfers currently being received (or awaiting acceptance). */
export const pendingIncomingTransfers: Map<string, PendingTransfer> = new Map()

interface AcceptWaiter {
    resolve: () => void
    reject: (err: Error) => void
    timeout: ReturnType<typeof setTimeout>
}

/** Sender-side waiters for the receiver's FILE_ACCEPT / FILE_REJECT answer. */
const acceptWaiters: Map<string, AcceptWaiter> = new Map()

/** Transfer ids whose sending loop must stop (user cancelled). */
const cancelledTransfers: Set<string> = new Set()

export const isTransferCancelled = (transferId: string): boolean => cancelledTransfers.has(transferId)

export const markTransferCancelled = (transferId: string): void => {
    cancelledTransfers.add(transferId)
}

/**
 * Register a waiter that resolves on FILE_ACCEPT and rejects on FILE_REJECT
 * or after `timeoutMs` with no answer.
 */
export const waitForAcceptance = (transferId: string, timeoutMs: number): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            acceptWaiters.delete(transferId)
            reject(new Error('Peer did not respond to the file request'))
        }, timeoutMs)
        acceptWaiters.set(transferId, { resolve, reject, timeout })
    })

export const resolveAcceptWaiter = (transferId: string): void => {
    const waiter = acceptWaiters.get(transferId)
    if (waiter) {
        clearTimeout(waiter.timeout)
        acceptWaiters.delete(transferId)
        waiter.resolve()
    }
}

export const rejectAcceptWaiter = (transferId: string, reason: string): void => {
    const waiter = acceptWaiters.get(transferId)
    if (waiter) {
        clearTimeout(waiter.timeout)
        acceptWaiters.delete(transferId)
        waiter.reject(new Error(reason))
    }
}

/** Remove every trace of a transfer (finished, rejected, or cancelled). */
export const clearTransferState = (transferId: string): void => {
    pendingIncomingTransfers.delete(transferId)
    cancelledTransfers.delete(transferId)
    const waiter = acceptWaiters.get(transferId)
    if (waiter) {
        clearTimeout(waiter.timeout)
        acceptWaiters.delete(transferId)
        waiter.reject(new Error('Transfer aborted'))
    }
    log.debug('Transfer state cleared: ' + transferId)
}

/** Drop all transfer state (session stop). */
export const clearAllTransferState = (): void => {
    acceptWaiters.forEach((waiter) => {
        clearTimeout(waiter.timeout)
        waiter.reject(new Error('Transfer aborted'))
    })
    acceptWaiters.clear()
    pendingIncomingTransfers.clear()
    cancelledTransfers.clear()
    log.debug('All transfer state cleared')
}
