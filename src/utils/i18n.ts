export type Language = 'en' | 'zh'

export interface Translations {
    // Header
    appTitle: string
    startSession: string
    stopping: string
    stop: string
    settings: string
    copyId: string

    // Sidebar
    chats: string
    noConnections: string
    noConnectionsHint: string
    enterPeerId: string
    connect: string

    // Chat
    selectConnection: string
    selectConnectionHint: string
    typeMessage: string
    sendFile: string
    sendImage: string
    clearChat: string
    peerIsTyping: string
    imagePasted: string
    pasteImage: string
    closePreview: string
    downloadImage: string

    // Settings
    appearance: string
    light: string
    dark: string
    system: string
    security: string
    endToEndEncryption: string
    encryptionDesc: string
    notifications: string
    enableNotifications: string
    notificationsDesc: string
    about: string
    secureP2P: string
    language: string

    // File Transfer
    sendFileTitle: string
    receiveFileTitle: string
    sendTo: string
    from: string
    accept: string
    reject: string
    send: string
    cancel: string
    pending: string
    transferring: string
    completed: string
    cancelled: string
    error: string
    largeFileWarning: string
    previewNotAvailable: string
    download: string

    // File Message
    sending: string
    receiving: string
    speed: string
    progress: string
    fileSent: string
    fileReceived: string

    // Key Verification
    verifyKeys: string
    verifyKeysDesc: string
    yourFingerprint: string
    peerFingerprint: string
    keysVerified: string
    keysMismatch: string
    close: string

    // Connection Request
    connectionRequest: string
    connectionRequestDesc: string
    connectionAccepted: string
    connectionRejected: string

    // Log Viewer
    logViewer: string
    clearLogs: string
    level: string
    module: string
    entries: string
    noLogs: string
    all: string

    // Common
    copied: string
    connectionClosed: string
    excellent: string
    good: string
    poor: string
    unknown: string
    latency: string
    connectionQuality: string
    incomingConnection: string
    pleaseEnterId: string
    pleaseSelectConnection: string
    pleaseSelectFile: string
    sendFileSuccess: string
    sendFileError: string
}

const en: Translations = {
    appTitle: 'P2P Messenger',
    startSession: 'Start Session',
    stopping: 'Starting...',
    stop: 'Stop',
    settings: 'Settings',
    copyId: 'Copy ID',

    chats: 'Chats',
    noConnections: 'No connections yet',
    noConnectionsHint: 'Click + to connect to a peer',
    enterPeerId: 'Enter peer ID...',
    connect: 'Connect',

    selectConnection: 'Select a connection',
    selectConnectionHint: 'Choose a peer from the sidebar to start chatting',
    typeMessage: 'Type a message...',
    sendFile: 'Send file',
    sendImage: 'Send image',
    clearChat: 'Clear chat',
    peerIsTyping: 'is typing...',
    imagePasted: 'Image pasted',
    pasteImage: 'Paste image from clipboard (Ctrl+V)',
    closePreview: 'Close preview',
    downloadImage: 'Download image',

    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    security: 'Security',
    endToEndEncryption: 'End-to-End Encryption',
    encryptionDesc: 'Encrypt all messages and files',
    notifications: 'Notifications',
    enableNotifications: 'Enable Notifications',
    notificationsDesc: 'Show notifications for new messages',
    about: 'About',
    secureP2P: 'Secure peer-to-peer communication',
    language: 'Language',

    sendFileTitle: 'Send File',
    receiveFileTitle: 'Receive File',
    sendTo: 'Send to',
    from: 'From',
    accept: 'Accept',
    reject: 'Reject',
    send: 'Send',
    cancel: 'Cancel',
    pending: 'Pending',
    transferring: 'Transferring',
    completed: 'Completed',
    cancelled: 'Cancelled',
    error: 'Error',
    largeFileWarning: 'This is a large file. Accept transfer?',
    previewNotAvailable: 'Preview not available',
    download: 'Download',

    sending: 'Sending...',
    receiving: 'Receiving...',
    speed: 'Speed',
    progress: 'Progress',
    fileSent: 'File sent',
    fileReceived: 'File received',

    verifyKeys: 'Verify Keys',
    verifyKeysDesc: 'Compare these fingerprints with your peer to ensure secure connection',
    yourFingerprint: 'Your Fingerprint',
    peerFingerprint: 'Peer Fingerprint',
    keysVerified: 'Keys verified - Connection is secure',
    keysMismatch: 'Keys do not match - Connection may not be secure',
    close: 'Close',

    connectionRequest: 'Connection Request',
    connectionRequestDesc: 'wants to connect with you',
    connectionAccepted: 'Connection accepted',
    connectionRejected: 'Connection rejected',

    logViewer: 'Log Viewer',
    clearLogs: 'Clear Logs',
    level: 'Level',
    module: 'Module',
    entries: 'entries',
    noLogs: 'No logs',
    all: 'All',

    copied: 'Copied',
    connectionClosed: 'Connection closed',
    excellent: 'Excellent',
    good: 'Good',
    poor: 'Poor',
    unknown: 'Unknown',
    latency: 'Latency',
    connectionQuality: 'Connection Quality',
    incomingConnection: 'Incoming connection',
    pleaseEnterId: 'Please enter a peer ID',
    pleaseSelectConnection: 'Please select a connection',
    pleaseSelectFile: 'Please select a file',
    sendFileSuccess: 'File sent successfully',
    sendFileError: 'Error sending file',
}

const zh: Translations = {
    appTitle: 'P2P 加密通讯',
    startSession: '启动会话',
    stopping: '启动中...',
    stop: '停止',
    settings: '设置',
    copyId: '复制 ID',

    chats: '聊天',
    noConnections: '暂无连接',
    noConnectionsHint: '点击 + 连接对等方',
    enterPeerId: '输入对等方 ID...',
    connect: '连接',

    selectConnection: '选择一个连接',
    selectConnectionHint: '从侧边栏选择一个对等方开始聊天',
    typeMessage: '输入消息...',
    sendFile: '发送文件',
    sendImage: '发送图片',
    clearChat: '清空聊天',
    peerIsTyping: '正在输入...',
    imagePasted: '图片已粘贴',
    pasteImage: '从剪贴板粘贴图片 (Ctrl+V)',
    closePreview: '关闭预览',
    downloadImage: '下载图片',

    appearance: '外观',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
    security: '安全',
    endToEndEncryption: '端到端加密',
    encryptionDesc: '加密所有消息和文件',
    notifications: '通知',
    enableNotifications: '启用通知',
    notificationsDesc: '显示新消息通知',
    about: '关于',
    secureP2P: '安全的点对点通讯',
    language: '语言',

    sendFileTitle: '发送文件',
    receiveFileTitle: '接收文件',
    sendTo: '发送给',
    from: '来自',
    accept: '接受',
    reject: '拒绝',
    send: '发送',
    cancel: '取消',
    pending: '等待中',
    transferring: '传输中',
    completed: '已完成',
    cancelled: '已取消',
    error: '错误',
    largeFileWarning: '这是一个大文件，是否接受传输？',
    previewNotAvailable: '无法预览',
    download: '下载',

    sending: '发送中...',
    receiving: '接收中...',
    speed: '速度',
    progress: '进度',
    fileSent: '文件已发送',
    fileReceived: '文件已接收',

    verifyKeys: '验证密钥',
    verifyKeysDesc: '与对方比较这些指纹以确保安全连接',
    yourFingerprint: '你的指纹',
    peerFingerprint: '对方指纹',
    keysVerified: '密钥已验证 - 连接安全',
    keysMismatch: '密钥不匹配 - 连接可能不安全',
    close: '关闭',

    connectionRequest: '连接请求',
    connectionRequestDesc: '想要与你建立连接',
    connectionAccepted: '已接受连接',
    connectionRejected: '已拒绝连接',

    logViewer: '日志查看器',
    clearLogs: '清除日志',
    level: '级别',
    module: '模块',
    entries: '条记录',
    noLogs: '暂无日志',
    all: '全部',

    copied: '已复制',
    connectionClosed: '连接已关闭',
    excellent: '优秀',
    good: '良好',
    poor: '较差',
    unknown: '未知',
    latency: '延迟',
    connectionQuality: '连接质量',
    incomingConnection: '收到连接请求',
    pleaseEnterId: '请输入对等方 ID',
    pleaseSelectConnection: '请选择一个连接',
    pleaseSelectFile: '请选择一个文件',
    sendFileSuccess: '文件发送成功',
    sendFileError: '文件发送失败',
}

export const translations: Record<Language, Translations> = {
    en,
    zh,
}

const LANGUAGE_STORAGE_KEY = 'p2p-messenger-language'

export const getStoredLanguage = (): Language => {
    try {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
        if (stored === 'en' || stored === 'zh') return stored
    } catch {}
    // Detect browser language
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('zh') ? 'zh' : 'en'
}

export const storeLanguage = (lang: Language): void => {
    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    } catch {}
}
