import {ChatActionType, ChatMessage} from "./chatTypes";
import {Dispatch} from "redux";
import {DataType, PeerConnection} from "../../helpers/peer";
import {encryptionManager} from "../../services/encryptionService";
import {createLogger} from "../../services/logService";

const log = createLogger('ChatActions')

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

/** Patch fields of an existing chat message (e.g. attach image data on receipt). */
export const updateChatMessage = (peerId: string, messageId: string, patch: Partial<ChatMessage>) => ({
    type: ChatActionType.CHAT_MESSAGE_UPDATE, peerId, messageId, patch
})

/**
 * Serialize a chat message to its wire form. When an encryption session
 * exists and encryption is enabled, the payload is AES-256-GCM encrypted.
 */
const buildChatPayload = async (peerId: string, payload: Record<string, unknown>, encryptionEnabled: boolean) => {
    const plain = JSON.stringify(payload)
    if (encryptionEnabled && encryptionManager.hasSessionKey(peerId)) {
        const encrypted = await encryptionManager.encryptString(peerId, plain)
        return {
            dataType: DataType.OTHER,
            encrypted: true,
            iv: encrypted.iv,
            payload: encrypted.data,
        }
    }
    return {
        dataType: DataType.OTHER,
        message: plain,
    }
}

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

    log.debug('Sending message to peer: ' + peerId + ', type: ' + type)

    dispatch(addChatMessage(peerId, message))

    // Images travel through the chunked file protocol (see useFileTransfer);
    // only text (and typing) messages go through this path.
    const data = await buildChatPayload(peerId, {...message, dataType: 'CHAT_MESSAGE'}, state.settings.encryptionEnabled)

    try {
        await PeerConnection.sendConnection(peerId, data)
        log.debug('Message sent successfully to peer: ' + peerId)
    } catch (err) {
        log.error('Failed to send message to peer: ' + peerId, err)
        throw err
    }
})

/**
 * Send a typing indicator. `typing=false` is only meaningful right after a
 * `typing=true`; the receiver auto-clears after a timeout either way.
 */
export const sendTyping:
    (peerId: string, typing: boolean) => (dispatch: Dispatch, getState: () => any) => Promise<void>
    = (peerId, typing) => (async (_dispatch, getState) => {
    const data = await buildChatPayload(peerId, {dataType: 'TYPING', typing}, getState().settings.encryptionEnabled)
    try {
        await PeerConnection.sendConnection(peerId, data)
    } catch (err) {
        log.debug('Failed to send typing indicator to peer: ' + peerId, err)
    }
})

/**
 * Tell the sender a message was delivered/read. Both statuses use the same
 * encrypted OTHER channel; the sender patches the chat message on receipt.
 */
export const sendReceipt:
    (peerId: string, messageId: string, status: 'delivered' | 'read') =>
        (dispatch: Dispatch, getState: () => any) => Promise<void>
    = (peerId, messageId, status) => (async (_dispatch, getState) => {
    const data = await buildChatPayload(peerId, {dataType: 'RECEIPT', messageId, status}, getState().settings.encryptionEnabled)
    try {
        await PeerConnection.sendConnection(peerId, data)
    } catch (err) {
        log.debug('Failed to send receipt to peer: ' + peerId, err)
    }
})

/**
 * Send read receipts for every incoming message from a peer (catch-up when
 * the user opens the conversation).
 */
export const sendReadReceipts:
    (peerId: string) => (dispatch: Dispatch, getState: () => any) => Promise<void>
    = (peerId) => (async (_dispatch, getState) => {
    const state = getState()
    const messages = (state.chat.messages[peerId] as ChatMessage[] | undefined) ?? []
    const incoming = messages.filter(m => m.senderId === peerId)
    for (const message of incoming) {
        try {
            await sendReceipt(peerId, message.id, 'read')(_dispatch, getState)
        } catch {
            // best effort
        }
    }
})
