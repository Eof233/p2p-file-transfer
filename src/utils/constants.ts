// File Transfer
export const MAX_FILE_SIZE_DEFAULT = 100 * 1024 * 1024  // 100MB
export const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024  // 5MB - requires confirmation

// Chat
export const MAX_MESSAGE_LENGTH = 10000
export const TYPING_TIMEOUT = 3000  // ms

// Storage Keys
export const STORAGE_KEYS = {
    SETTINGS: 'p2p-messenger-settings',
    CONNECTION_HISTORY: 'p2p-messenger-connections',
    CHAT_HISTORY: 'p2p-messenger-chat',
} as const
