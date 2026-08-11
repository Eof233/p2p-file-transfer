export enum FileActionType {
    FILE_TRANSFER_START = 'FILE_TRANSFER_START',
    FILE_TRANSFER_PROGRESS = 'FILE_TRANSFER_PROGRESS',
    FILE_TRANSFER_COMPLETE = 'FILE_TRANSFER_COMPLETE',
    FILE_TRANSFER_CANCEL = 'FILE_TRANSFER_CANCEL',
    FILE_TRANSFER_ERROR = 'FILE_TRANSFER_ERROR',
    FILE_PENDING_ADD = 'FILE_PENDING_ADD',
    FILE_PENDING_REMOVE = 'FILE_PENDING_REMOVE',
    FILE_RESET = 'FILE_RESET',
}

export interface FileTransfer {
    readonly id: string
    readonly fileName: string
    readonly fileSize: number
    readonly fileType: string
    readonly peerId: string
    readonly direction: 'send' | 'receive'
    readonly progress: number  // 0-100
    readonly status: 'pending' | 'transferring' | 'completed' | 'cancelled' | 'error'
    readonly speed?: number  // bytes per second
    readonly error?: string
    readonly blob?: Blob  // received file blob for download
}

export interface PendingFile {
    readonly id: string
    readonly fileName: string
    readonly fileSize: number
    readonly fileType: string
    readonly peerId: string
    readonly blob?: Blob
}

export interface FileState {
    readonly transfers: Record<string, FileTransfer>  // keyed by transfer id
    readonly pendingFiles: PendingFile[]  // files awaiting acceptance
}
