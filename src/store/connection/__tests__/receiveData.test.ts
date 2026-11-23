import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handleReceivedData } from '../receiveData'
import { store } from '../../index'
import { DataType, Data, PeerConnection } from '../../../helpers/peer'
import { addChatMessage, clearChatMessages } from '../../chat/chatActions'
import { clearAllReceiptQueues } from '../../chat/receiptQueue'
import { ChatMessage } from '../../chat/chatTypes'
import { fileTransferStart, resetFileTransfers } from '../../file/fileActions'
import {
    clearAllTransferState,
    isTransferCancelled,
    pendingIncomingTransfers,
    waitForAcceptance,
    waitForEndAnswer,
} from '../../file/transferCoordinator'

const PEER = 'remote-peer'
const ME = 'local-peer'

/** Let the per-peer receive queue (a promise chain) run to completion. */
const settle = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

const receive = async (data: Data): Promise<void> => {
    handleReceivedData(PEER, data, store.dispatch)
    await settle()
}

const chat = (body: Record<string, unknown>): Data => ({
    dataType: DataType.OTHER,
    message: JSON.stringify(body),
})

const fileMessage = (message: string, transferId: string, extra: Partial<Data> = {}): Data => ({
    dataType: DataType.FILE,
    message,
    transferId,
    ...extra,
})

const messages = (): ChatMessage[] => store.getState().chat.messages[PEER] ?? []

const ownMessage = (id: string, status: ChatMessage['status']): ChatMessage => ({
    id,
    senderId: ME,
    content: 'hi',
    timestamp: 1,
    type: 'text',
    status,
})

describe('receiveData pipeline', () => {
    beforeEach(() => {
        ;(globalThis as any).document = { visibilityState: 'visible' }
        vi.spyOn(PeerConnection, 'sendConnection').mockResolvedValue(undefined)
        store.dispatch(clearChatMessages())
        store.dispatch(resetFileTransfers())
        clearAllTransferState()
    })

    afterEach(() => {
        clearAllReceiptQueues()
        clearAllTransferState()
        vi.restoreAllMocks()
        delete (globalThis as any).document
    })

    it('attributes an incoming chat message to the channel peer, not the claimed sender', async () => {
        await receive(chat({ dataType: 'CHAT_MESSAGE', id: 'm1', senderId: ME, content: 'spoofed' }))

        expect(messages()).toHaveLength(1)
        expect(messages()[0].senderId).toBe(PEER)
    })

    it('does not let a late delivered receipt downgrade a read message', async () => {
        store.dispatch(addChatMessage(PEER, ownMessage('m2', 'read')))

        await receive(chat({ dataType: 'RECEIPT', messageId: 'm2', status: 'delivered' }))
        expect(messages()[0].status).toBe('read')
    })

    it('still applies delivered and read receipts in order', async () => {
        store.dispatch(addChatMessage(PEER, ownMessage('m3', 'sent')))

        await receive(chat({ dataType: 'RECEIPT', messageId: 'm3', status: 'delivered' }))
        expect(messages()[0].status).toBe('delivered')
        await receive(chat({ dataType: 'RECEIPT', messageId: 'm3', status: 'read' }))
        expect(messages()[0].status).toBe('read')
    })

    it('rejects FILE_CHUNK indexes outside the announced chunk range', async () => {
        await receive(fileMessage('FILE_START', 't1', { fileName: 'a.bin', fileSize: 4, fileType: 'text/plain' }))
        const entry = pendingIncomingTransfers.get('t1')
        expect(entry?.accepted).toBe(true)

        const chunk = new Blob(['data'])
        await receive(fileMessage('FILE_CHUNK', 't1', { chunkIndex: 5, totalChunks: 1, file: chunk }))
        await receive(fileMessage('FILE_CHUNK', 't1', { chunkIndex: -1, totalChunks: 1, file: chunk }))
        await receive(fileMessage('FILE_CHUNK', 't1', { chunkIndex: 0.5, totalChunks: 1, file: chunk }))
        expect(entry?.chunks.size).toBe(0)
        expect(store.getState().file.transfers.t1.progress).toBe(0)

        await receive(fileMessage('FILE_CHUNK', 't1', { chunkIndex: 0, totalChunks: 1, file: chunk }))
        expect(entry?.chunks.size).toBe(1)
        expect(store.getState().file.transfers.t1.progress).toBe(100)
    })

    it('drops receiver state without leaving a cancel flag when the sender cancels', async () => {
        await receive(fileMessage('FILE_START', 't2', { fileName: 'a.bin', fileSize: 4, fileType: 'text/plain' }))
        expect(pendingIncomingTransfers.has('t2')).toBe(true)

        await receive(fileMessage('FILE_CANCEL', 't2'))

        expect(pendingIncomingTransfers.has('t2')).toBe(false)
        expect(isTransferCancelled('t2')).toBe(false)
        expect(store.getState().file.transfers.t2.status).toBe('cancelled')
    })

    it('wakes a sender waiting for the receiver when the peer cancels', async () => {
        store.dispatch(fileTransferStart({
            id: 't3',
            fileName: 'a.bin',
            fileSize: 4,
            fileType: 'text/plain',
            peerId: PEER,
            direction: 'send',
            progress: 0,
            status: 'pending',
        }))
        const accept = waitForAcceptance('t3', 60_000)
        const end = waitForEndAnswer('t3', 60_000)
        const outcomes = Promise.allSettled([accept, end])

        await receive(fileMessage('FILE_CANCEL', 't3'))

        const [acceptOutcome, endOutcome] = await outcomes
        expect(acceptOutcome.status).toBe('rejected')
        expect(endOutcome.status).toBe('rejected')
        expect(isTransferCancelled('t3')).toBe(true)
        expect(store.getState().file.transfers.t3.status).toBe('cancelled')
    })
})
