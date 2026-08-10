import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { ChatMessage } from '../store/chat/chatTypes'
import { sendMessage, clearChatMessages } from '../store/chat/chatActions'

export const useChat = (peerId?: string) => {
    const dispatch = useAppDispatch()

    // chat slice is not yet registered in the store; cast to access the expected shape
    const messages = useAppSelector((state: any) =>
        peerId ? (state.chat?.messages?.[peerId] as ChatMessage[] | undefined) ?? [] : []
    )

    const typing = useAppSelector((state: any) =>
        peerId ? (state.chat?.typing?.[peerId] as boolean | undefined) ?? false : false
    )

    const myId = useAppSelector((state) => state.peer.id)

    const sendChatMessage = useCallback(
        (content: string, type: 'text' | 'image' | 'file' = 'text', additionalData?: Partial<ChatMessage>) => {
            if (!peerId) return
            dispatch(sendMessage(peerId, content, type, additionalData) as any)
        },
        [peerId, dispatch],
    )

    const clearMessages = useCallback(() => {
        if (!peerId) return
        dispatch(clearChatMessages(peerId))
    }, [peerId, dispatch])

    return {
        messages,
        typing,
        myId,
        sendMessage: sendChatMessage,
        clearMessages,
    }
}
