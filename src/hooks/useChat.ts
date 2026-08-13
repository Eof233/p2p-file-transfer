import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { ChatMessage } from '../store/chat/chatTypes'
import { sendMessage, sendTyping, clearChatMessages } from '../store/chat/chatActions'
import { createLogger } from '../services/logService'

const log = createLogger('useChat')

export const useChat = (peerId?: string) => {
    const dispatch = useAppDispatch()

    const messages = useAppSelector((state) =>
        peerId ? (state.chat.messages[peerId] as ChatMessage[] | undefined) ?? [] : []
    )

    const typing = useAppSelector((state) =>
        peerId ? (state.chat.typing[peerId] as boolean | undefined) ?? false : false
    )

    const myId = useAppSelector((state) => state.peer.id)

    const sendChatMessage = useCallback(
        (content: string, type: 'text' | 'image' | 'file' = 'text', additionalData?: Partial<ChatMessage>) => {
            if (!peerId) return
            log.debug('Sending message, type: ' + type + ', to peer: ' + peerId)
            dispatch(sendMessage(peerId, content, type, additionalData) as any)
        },
        [peerId, dispatch],
    )

    const setTyping = useCallback(
        (isTyping: boolean) => {
            if (!peerId) return
            dispatch(sendTyping(peerId, isTyping) as any)
        },
        [peerId, dispatch],
    )

    const clearMessages = useCallback(() => {
        if (!peerId) return
        log.debug('Clearing messages for peer: ' + peerId)
        dispatch(clearChatMessages(peerId))
    }, [peerId, dispatch])

    return {
        messages,
        typing,
        myId,
        sendMessage: sendChatMessage,
        setTyping,
        clearMessages,
    }
}
