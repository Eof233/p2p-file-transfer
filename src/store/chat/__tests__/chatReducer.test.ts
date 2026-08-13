import { describe, it, expect } from 'vitest'
import { ChatReducer, initialState } from '../chatReducer'
import { ChatActionType, ChatMessage } from '../chatTypes'

const makeMessage = (id: string, senderId: string): ChatMessage => ({
    id,
    senderId,
    content: 'hello',
    timestamp: 1000,
    type: 'text',
    status: 'sent',
})

describe('ChatReducer', () => {
    it('adds messages per peer', () => {
        const state = ChatReducer(initialState, {
            type: ChatActionType.CHAT_MESSAGE_ADD,
            peerId: 'peerA',
            message: makeMessage('m1', 'me'),
        })
        expect(state.messages.peerA).toHaveLength(1)
        expect(state.messages.peerB).toBeUndefined()

        const state2 = ChatReducer(state, {
            type: ChatActionType.CHAT_MESSAGE_ADD,
            peerId: 'peerA',
            message: makeMessage('m2', 'me'),
        })
        expect(state2.messages.peerA.map(m => m.id)).toEqual(['m1', 'm2'])
    })

    it('updates a message in place (receipts, image patch)', () => {
        const state = ChatReducer(initialState, {
            type: ChatActionType.CHAT_MESSAGE_ADD,
            peerId: 'peerA',
            message: makeMessage('m1', 'me'),
        })
        const updated = ChatReducer(state, {
            type: ChatActionType.CHAT_MESSAGE_UPDATE,
            peerId: 'peerA',
            messageId: 'm1',
            patch: { status: 'read', imageData: 'blob:http://x/1' },
        })
        expect(updated.messages.peerA[0].status).toBe('read')
        expect(updated.messages.peerA[0].imageData).toBe('blob:http://x/1')

        // unknown message id -> no change
        const same = ChatReducer(updated, {
            type: ChatActionType.CHAT_MESSAGE_UPDATE,
            peerId: 'peerA',
            messageId: 'nope',
            patch: { status: 'read' },
        })
        expect(same).toEqual(updated)
    })

    it('sets and clears typing state', () => {
        const state = ChatReducer(initialState, {
            type: ChatActionType.CHAT_TYPING_SET,
            peerId: 'peerA',
            typing: true,
        })
        expect(state.typing.peerA).toBe(true)

        const cleared = ChatReducer(state, {
            type: ChatActionType.CHAT_TYPING_SET,
            peerId: 'peerA',
            typing: false,
        })
        expect(cleared.typing.peerA).toBe(false)
    })

    it('sets history and clears messages', () => {
        const withHistory = ChatReducer(initialState, {
            type: ChatActionType.CHAT_HISTORY_SET,
            peerId: 'peerA',
            messages: [makeMessage('m1', 'me'), makeMessage('m2', 'peer')],
        })
        expect(withHistory.messages.peerA).toHaveLength(2)

        // clear one peer keeps others
        const twoPeers = ChatReducer(withHistory, {
            type: ChatActionType.CHAT_MESSAGE_ADD,
            peerId: 'peerB',
            message: makeMessage('m3', 'me'),
        })
        const cleared = ChatReducer(twoPeers, {
            type: ChatActionType.CHAT_MESSAGES_CLEAR,
            peerId: 'peerA',
        })
        expect(cleared.messages.peerA).toBeUndefined()
        expect(cleared.messages.peerB).toHaveLength(1)

        // clear all
        const clearedAll = ChatReducer(cleared, { type: ChatActionType.CHAT_MESSAGES_CLEAR })
        expect(clearedAll.messages).toEqual({})
    })

    it('returns the same state for unknown actions', () => {
        const state = ChatReducer(initialState, { type: 'UNKNOWN' })
        expect(state).toBe(initialState)
    })
})
