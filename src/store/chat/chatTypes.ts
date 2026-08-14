export enum ChatActionType {
    CHAT_MESSAGE_ADD = 'CHAT_MESSAGE_ADD',
    CHAT_HISTORY_SET = 'CHAT_HISTORY_SET',
    CHAT_TYPING_SET = 'CHAT_TYPING_SET',
    CHAT_MESSAGES_CLEAR = 'CHAT_MESSAGES_CLEAR',
    CHAT_MESSAGE_UPDATE = 'CHAT_MESSAGE_UPDATE',
}

export interface ChatMessage {
    readonly id: string
    readonly senderId: string
    readonly content: string
    readonly timestamp: number
    readonly type: 'text' | 'image' | 'file'
    // Delivery status is only meaningful for messages sent by the current
    // user (patched by incoming receipts); received messages never display
    // delivery marks.
    readonly status?: 'sent' | 'delivered' | 'read'
    readonly fileName?: string
    readonly fileSize?: number
    readonly fileType?: string
    readonly imageData?: string  // base64 for inline images
    readonly transferId?: string  // link to file transfer for progress tracking
}

export interface ChatState {
    readonly messages: Record<string, ChatMessage[]>  // keyed by peerId
    readonly typing: Record<string, boolean>  // keyed by peerId
}
