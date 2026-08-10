import {Reducer} from "redux";
import {ChatActionType, ChatState} from "./chatTypes";

export const initialState: ChatState = {
    messages: {},
    typing: {}
}

export const ChatReducer: Reducer<ChatState> = (state = initialState, action) => {
    switch (action.type) {
        case ChatActionType.CHAT_MESSAGE_ADD: {
            const {peerId, message} = action
            const existing = state.messages[peerId] || []
            return {...state, messages: {...state.messages, [peerId]: [...existing, message]}}
        }
        case ChatActionType.CHAT_HISTORY_SET: {
            const {peerId, messages} = action
            return {...state, messages: {...state.messages, [peerId]: messages}}
        }
        case ChatActionType.CHAT_TYPING_SET: {
            const {peerId, typing} = action
            return {...state, typing: {...state.typing, [peerId]: typing}}
        }
        case ChatActionType.CHAT_MESSAGES_CLEAR: {
            const {peerId} = action
            if (peerId) {
                const {[peerId]: _, ...remaining} = state.messages
                return {...state, messages: remaining}
            }
            return {...state, messages: {}}
        }
        default:
            return state
    }
}
