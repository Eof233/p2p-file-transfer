import {ChatActionType, ChatMessage} from "./chatTypes";
import {Dispatch} from "redux";
import {DataType, PeerConnection} from "../../helpers/peer";

export const addChatMessage = (peerId: string, message: ChatMessage) => ({
    type: ChatActionType.CHAT_MESSAGE_ADD, peerId, message
})

export const setChatHistory = (peerId: string, messages: ChatMessage[]) => ({
    type: ChatActionType.CHAT_HISTORY_SET, peerId, messages
})

export const setChatTyping = (peerId: string, typing: boolean) => ({
    type: ChatActionType.CHAT_TYPING_SET, peerId, typing
})

export const clearChatMessages = (peerId?: string) => ({
    type: ChatActionType.CHAT_MESSAGES_CLEAR, peerId
})

export const sendMessage:
    (peerId: string, content: string, type: 'text' | 'image' | 'file', additionalData?: Partial<ChatMessage>) =>
        (dispatch: Dispatch, getState: () => any) => Promise<void>
    = (peerId, content, type, additionalData) => (async (dispatch, getState) => {
    const state = getState()
    const senderId = state.peer.id

    const message: ChatMessage = {
        id: crypto.randomUUID(),
        senderId,
        content,
        timestamp: Date.now(),
        type,
        status: 'sent',
        ...additionalData
    }

    dispatch(addChatMessage(peerId, message))

    const data: any = {
        dataType: DataType.OTHER,
        message: JSON.stringify({...message, dataType: 'CHAT_MESSAGE'})
    }

    if (type === 'file') {
        data.dataType = DataType.FILE
        data.fileName = additionalData?.fileName
        data.fileType = additionalData?.fileType
        data.file = additionalData?.imageData ? undefined : undefined
    }

    await PeerConnection.sendConnection(peerId, data)
})
