import { createLogger } from '../../services/logService'
import { Data, PeerConnection } from '../../helpers/peer'

const log = createLogger('ReceiptQueue')

export type ReceiptStatus = 'delivered' | 'read'

/** One undelivered receipt waiting to be sent (or retried). */
export interface QueuedReceipt {
    messageId: string
    status: ReceiptStatus
    /** Wire payload, already encrypted when a session key exists. */
    data: Data
    /** How many failed send attempts have happened so far. */
    retryCount: number
}

/**
 * Status rank used for dedupe (per peer + message): 'read' supersedes
 * 'delivered', and a newer receipt with the same rank supersedes the older
 * one. A lower-ranked receipt never downgrades a queued one.
 */
const STATUS_RANK: Record<ReceiptStatus, number> = {
    delivered: 1,
    read: 2,
}

/** Failed attempts (after the initial one) before a receipt is dropped. */
const MAX_RETRIES = 3

/** Backoff delays between retry attempts, in milliseconds. */
const RETRY_DELAYS = [1000, 2000, 4000]

interface PeerQueueState {
    entries: QueuedReceipt[]
    /** True while the head entry is being sent (delivery is serialized). */
    sending: boolean
    /** Pending retry timer for the head entry, if one is scheduled. */
    timer: ReturnType<typeof setTimeout> | undefined
}

/**
 * Per-peer FIFO queues of undelivered receipts. Module-level state (like
 * transferCoordinator) so the queue survives component unmounts; keyed by
 * peerId. Exported for tests.
 */
export const receiptQueues: Map<string, PeerQueueState> = new Map()

/** Peers whose disconnect hook is already registered with PeerConnection. */
const disconnectHooks: Set<string> = new Set()

type ReceiptSender = (peerId: string, data: Data) => Promise<void>

const defaultSendFn: ReceiptSender = (peerId, data) => PeerConnection.sendConnection(peerId, data)

let sendFn: ReceiptSender = defaultSendFn

/** Test seam: replace the transport used for delivery attempts. */
export const setReceiptSendFunction = (fn: ReceiptSender): void => {
    sendFn = fn
}

/**
 * Index of a queued receipt for the same message, or -1. The head entry
 * currently in flight is already (being) sent, so a newer receipt for the
 * same message is queued behind it instead of mutating it mid-flight.
 */
const findQueued = (state: PeerQueueState, messageId: string): number => {
    const start = state.sending ? 1 : 0
    for (let i = start; i < state.entries.length; i++) {
        if (state.entries[i].messageId === messageId) return i
    }
    return -1
}

/**
 * Register (once per peer) a close listener so the whole queue — including
 * any pending retry timer — is dropped the moment the data channel closes.
 */
const registerDisconnectHook = (peerId: string): void => {
    if (disconnectHooks.has(peerId)) return
    if (!PeerConnection.isConnected(peerId)) {
        // No live connection to hook into; the queue drops by itself once
        // the retry budget is exhausted.
        return
    }
    disconnectHooks.add(peerId)
    PeerConnection.onConnectionDisconnected(peerId, () => clearReceiptQueue(peerId))
}

/**
 * Deliver the head of a peer's queue. FIFO: only the head is attempted; a
 * failed head stays in place and is retried with backoff before the rest of
 * the queue is touched. Sent (or dropped) entries make room for the next.
 */
const flush = async (peerId: string): Promise<void> => {
    const state = receiptQueues.get(peerId)
    if (!state || state.sending || state.timer !== undefined) return

    if (state.entries.length === 0) {
        receiptQueues.delete(peerId)
        return
    }

    const entry = state.entries[0]
    state.sending = true
    try {
        await sendFn(peerId, entry.data)
        state.entries.shift()
        state.sending = false
        void flush(peerId)
    } catch (err) {
        entry.retryCount += 1
        state.sending = false
        if (entry.retryCount > MAX_RETRIES) {
            log.warn('Dropping receipt after ' + MAX_RETRIES + ' failed retries: ' + peerId + ', message: ' + entry.messageId)
            state.entries.shift()
            void flush(peerId)
        } else {
            const delay = RETRY_DELAYS[entry.retryCount - 1]
            log.debug('Receipt send failed, retrying in ' + delay + 'ms: ' + peerId, err)
            state.timer = setTimeout(() => {
                state.timer = undefined
                void flush(peerId)
            }, delay)
        }
    }
}

/**
 * Queue a receipt for delivery. An immediate send is attempted; on failure
 * the entry stays at the head and is retried with backoff (see MAX_RETRIES).
 */
export const enqueueReceipt = (peerId: string, messageId: string, status: ReceiptStatus, data: Data): void => {
    let state = receiptQueues.get(peerId)
    if (!state) {
        state = { entries: [], sending: false, timer: undefined }
        receiptQueues.set(peerId, state)
        registerDisconnectHook(peerId)
    }

    const existingIndex = findQueued(state, messageId)
    if (existingIndex >= 0) {
        const existing = state.entries[existingIndex]
        // Supersede unless the new receipt is strictly lower-ranked (e.g.
        // 'delivered' after a queued 'read'); keep the retry count so a
        // long-failing entry still hits the drop budget.
        if (STATUS_RANK[status] < STATUS_RANK[existing.status]) return
        existing.status = status
        existing.data = data
    } else {
        state.entries.push({ messageId, status, data, retryCount: 0 })
    }

    if (!state.sending && state.timer === undefined) {
        void flush(peerId)
    }
}

/**
 * Drop a peer's undelivered receipts and cancel its retry timer. Invoked by
 * the disconnect hook when the data channel closes; safe to call multiple
 * times.
 */
export const clearReceiptQueue = (peerId: string): void => {
    const state = receiptQueues.get(peerId)
    if (state && state.timer !== undefined) {
        clearTimeout(state.timer)
    }
    receiptQueues.delete(peerId)
    disconnectHooks.delete(peerId)
}

/** Drop every peer's queue and cancel all retry timers (session teardown). */
export const clearAllReceiptQueues = (): void => {
    receiptQueues.forEach((state) => {
        if (state.timer !== undefined) clearTimeout(state.timer)
    })
    receiptQueues.clear()
    disconnectHooks.clear()
}
