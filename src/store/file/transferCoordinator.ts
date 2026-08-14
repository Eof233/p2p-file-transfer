import { createLogger } from '../../services/logService'
import { DataType, Data, PeerConnection } from '../../helpers/peer'
import { encryptionManager } from '../../services/encryptionService'
import { FileChunk } from '../../services/fileService'

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
    /** How many FILE_MISSING retransmission rounds happened so far. */
    retransmitRounds: number
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

/** Transfer ids whose sending loop must hold between chunks (user paused). */
const pausedTransfers: Set<string> = new Set()

export const isTransferPaused = (transferId: string): boolean => pausedTransfers.has(transferId)

export const markTransferPaused = (transferId: string): void => {
    pausedTransfers.add(transferId)
}

export const unmarkTransferPaused = (transferId: string): void => {
    pausedTransfers.delete(transferId)
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

// --- End-of-transfer answer (chunk retransmission) --------------------------
// After FILE_END the receiver answers with FILE_COMPLETE (all chunks present)
// or FILE_MISSING (list of chunk indexes to resend).

export type EndAnswer =
    | { kind: 'complete'; missing?: never }
    | { kind: 'missing'; missing: number[] }

interface EndWaiter {
    resolve: (answer: EndAnswer) => void
    reject: (err: Error) => void
    timeout: ReturnType<typeof setTimeout>
}

const endWaiters: Map<string, EndWaiter> = new Map()

export const waitForEndAnswer = (transferId: string, timeoutMs: number): Promise<EndAnswer> =>
    new Promise<EndAnswer>((resolve, reject) => {
        const timeout = setTimeout(() => {
            endWaiters.delete(transferId)
            reject(new Error('Peer did not confirm transfer completion'))
        }, timeoutMs)
        endWaiters.set(transferId, { resolve, reject, timeout })
    })

export const answerEndWaiter = (transferId: string, answer: EndAnswer): void => {
    const waiter = endWaiters.get(transferId)
    if (waiter) {
        clearTimeout(waiter.timeout)
        endWaiters.delete(transferId)
        waiter.resolve(answer)
    }
}

// --- Sender-side transfer state (pause/resume + interrupted recovery) --------
// The sender keeps its live chunk buffers and position outside Redux so an
// interrupted transfer can be resumed in the same session from the next
// unsent chunk index. Cleared together with the rest of the transfer state on
// completion, cancellation or a permanent error.

export interface SenderTransferState {
    peerId: string
    fileName: string
    fileType: string
    chunks: FileChunk[]
    /** Chunk indexes still to send in the current pass (unsent tail or FILE_MISSING list). */
    pendingIndexes: number[]
    /** Chunk indexes already handed to the channel (drives progress accounting). */
    sentIndexes: Set<number>
    /** How many FILE_MISSING retransmission rounds happened so far. */
    retransmitRounds: number
    /** Whether chunks are encrypted on the wire (depends on the session key at start). */
    useEncryption: boolean
    /** Speed calculation baseline; reset when a transfer is resumed. */
    startTime: number
    bytesSent: number
    /** True while the send loop is running (guards against concurrent resumes). */
    active: boolean
}

const senderTransfers: Map<string, SenderTransferState> = new Map()

export const getSenderTransferState = (transferId: string): SenderTransferState | undefined =>
    senderTransfers.get(transferId)

export const setSenderTransferState = (transferId: string, state: SenderTransferState): void => {
    senderTransfers.set(transferId, state)
}

/**
 * Raised when the data channel drops mid-transfer. Unlike a permanent error,
 * the transfer stays resumable: the sender keeps its chunk state and the
 * receiver keeps its buffer until the user resumes.
 */
export class TransferInterruptedError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'TransferInterruptedError'
    }
}

/**
 * Clean up the sender side of an interrupted transfer: drop waiters and the
 * cancel flag, but KEEP the module-level sender state so a later resume can
 * continue from the next unsent chunk index.
 */
export const interruptTransferState = (transferId: string): void => {
    cancelledTransfers.delete(transferId)
    const waiter = acceptWaiters.get(transferId)
    if (waiter) {
        clearTimeout(waiter.timeout)
        acceptWaiters.delete(transferId)
        waiter.reject(new Error('Transfer interrupted'))
    }
    const endWaiter = endWaiters.get(transferId)
    if (endWaiter) {
        clearTimeout(endWaiter.timeout)
        endWaiters.delete(transferId)
        endWaiter.reject(new Error('Transfer interrupted'))
    }
    log.debug('Transfer interrupted, sender state kept: ' + transferId)
}

// --- Encrypted FILE control messages ----------------------------------------
// FILE_ACCEPT / FILE_REJECT / FILE_CANCEL / FILE_COMPLETE / FILE_MISSING carry
// a JSON body that is AES-256-GCM encrypted like FILE_START metadata when a
// session key exists and encryption is enabled. The envelope keeps the routing
// fields (dataType/message/transferId) in plaintext; legacy peers send these
// messages plaintext, so the receiver falls back to the envelope fields.

const FILE_CONTROL_MESSAGES = ['FILE_ACCEPT', 'FILE_REJECT', 'FILE_CANCEL', 'FILE_COMPLETE', 'FILE_MISSING']

/** True for FILE protocol messages whose JSON body is encrypted on the wire. */
export const isFileControlMessage = (message: string): boolean => FILE_CONTROL_MESSAGES.includes(message)

interface FileControlSendOptions {
    /** The settings "encryption enabled" toggle; combined with a session key. */
    encryptionEnabled: boolean
    /** Extra fields to carry inside the message body (e.g. missingChunks). */
    extra?: Record<string, unknown>
}

/**
 * Send a FILE control message, encrypting the JSON body exactly like FILE_START
 * metadata when a session key exists and encryption is enabled. Otherwise it is
 * sent as legacy plaintext envelope fields.
 */
export const sendFileControlMessage = async (
    peerId: string,
    transferId: string,
    message: string,
    options?: FileControlSendOptions,
): Promise<void> => {
    const extra = options?.extra ?? {}
    if (options?.encryptionEnabled && encryptionManager.hasSessionKey(peerId)) {
        const encrypted = await encryptionManager.encryptString(peerId, JSON.stringify({ message, transferId, ...extra }))
        await PeerConnection.sendConnection(peerId, {
            dataType: DataType.FILE,
            message,
            transferId,
            encrypted: true,
            iv: encrypted.iv,
            payload: encrypted.data,
        })
        return
    }
    await PeerConnection.sendConnection(peerId, {
        dataType: DataType.FILE,
        message,
        transferId,
        ...(extra as Partial<Data>),
    })
}

/**
 * Decrypt the JSON body of an encrypted FILE control message (mirror of the
 * FILE_START decryption in the receive pipeline). Returns the parsed JSON, or
 * null when the message is legacy plaintext (no `encrypted` flag) or cannot be
 * decrypted — callers then fall back to the envelope fields.
 */
export const decryptFileControl = async (peerId: string, data: Data): Promise<Record<string, unknown> | null> => {
    if (!data.encrypted) {
        // Legacy peer: control messages travel as plaintext envelope fields
        log.debug('Legacy plaintext FILE control message from peer: ' + peerId + ', message: ' + data.message)
        return null
    }
    if (!data.iv || !data.payload) {
        log.warn('Encrypted FILE control message missing iv/payload from peer: ' + peerId)
        return null
    }
    try {
        const plaintext = await encryptionManager.decryptString(peerId, { iv: data.iv, data: data.payload })
        return JSON.parse(plaintext) as Record<string, unknown>
    } catch (e) {
        log.debug('Failed to decrypt FILE control message, falling back to plaintext from peer: ' + peerId, e)
        return null
    }
}

// --- Cleanup ----------------------------------------------------------------

/** Remove every trace of a transfer (finished, rejected, or cancelled). */
export const clearTransferState = (transferId: string): void => {
    pendingIncomingTransfers.delete(transferId)
    cancelledTransfers.delete(transferId)
    pausedTransfers.delete(transferId)
    senderTransfers.delete(transferId)
    const waiter = acceptWaiters.get(transferId)
    if (waiter) {
        clearTimeout(waiter.timeout)
        acceptWaiters.delete(transferId)
        waiter.reject(new Error('Transfer aborted'))
    }
    const endWaiter = endWaiters.get(transferId)
    if (endWaiter) {
        clearTimeout(endWaiter.timeout)
        endWaiters.delete(transferId)
        endWaiter.reject(new Error('Transfer aborted'))
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
    endWaiters.forEach((waiter) => {
        clearTimeout(waiter.timeout)
        waiter.reject(new Error('Transfer aborted'))
    })
    endWaiters.clear()
    pendingIncomingTransfers.clear()
    cancelledTransfers.clear()
    pausedTransfers.clear()
    senderTransfers.clear()
    log.debug('All transfer state cleared')
}
