// PeerJS Configuration
export const PEER_CONFIG = {
    debug: 0,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    },
}

// File Transfer
export const MAX_FILE_SIZE_DEFAULT = 100 * 1024 * 1024  // 100MB
export const CHUNK_SIZE = 16 * 1024  // 16KB for WebRTC
export const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024  // 5MB - requires confirmation

// Chat
export const MAX_MESSAGE_LENGTH = 10000
export const TYPING_TIMEOUT = 3000  // ms

// UI
export const SIDEBAR_WIDTH = 280
export const HEADER_HEIGHT = 56
export const ANIMATION_DURATION = {
    fast: 100,
    normal: 200,
    slow: 300,
} as const

// Storage Keys
export const STORAGE_KEYS = {
    SETTINGS: 'p2p-messenger-settings',
    CONNECTION_HISTORY: 'p2p-messenger-connections',
    CHAT_HISTORY: 'p2p-messenger-chat',
} as const
