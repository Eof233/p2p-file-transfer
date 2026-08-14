import {FileActionType, FileTransfer} from "./fileTypes";
import {Dispatch} from "redux";
import {addChatMessage} from "../chat/chatActions";
import {ChatMessage} from "../chat/chatTypes";
import {pendingIncomingTransfers, clearTransferState, sendFileControlMessage} from "./transferCoordinator";
import {store} from "../index";
import {createLogger} from "../../services/logService";

const log = createLogger('FileActions')

export const fileTransferStart = (transfer: FileTransfer) => ({
    type: FileActionType.FILE_TRANSFER_START, ...transfer
})

export const fileTransferProgress = (id: string, progress: number, speed?: number) => ({
    type: FileActionType.FILE_TRANSFER_PROGRESS, id, progress, speed
})

export const fileTransferComplete = (id: string, blob?: Blob) => ({
    type: FileActionType.FILE_TRANSFER_COMPLETE, id, blob
})

export const fileTransferCancel = (id: string) => ({
    type: FileActionType.FILE_TRANSFER_CANCEL, id
})

export const fileTransferError = (id: string, error: string) => ({
    type: FileActionType.FILE_TRANSFER_ERROR, id, error
})

/** Receiver accepted our FILE_START: switch from waiting to transferring. */
export const fileTransferAccept = (id: string) => ({
    type: FileActionType.FILE_TRANSFER_ACCEPT, id
})

/** Sender paused the transfer between chunks. */
export const fileTransferPause = (id: string) => ({
    type: FileActionType.FILE_TRANSFER_PAUSE, id
})

/** Sender resumed a paused or interrupted transfer. */
export const fileTransferResume = (id: string) => ({
    type: FileActionType.FILE_TRANSFER_RESUME, id
})

/** The data channel dropped mid-transfer; the transfer stays resumable. */
export const fileTransferInterrupt = (id: string) => ({
    type: FileActionType.FILE_TRANSFER_INTERRUPT, id
})

export const filePendingAdd = (id: string, fileName: string, fileSize: number, fileType: string, peerId: string, blob?: Blob) => ({
    type: FileActionType.FILE_PENDING_ADD, id, fileName, fileSize, fileType, peerId, blob
})

export const filePendingRemove = (id: string) => ({
    type: FileActionType.FILE_PENDING_REMOVE, id
})

export const resetFileTransfers = () => ({
    type: FileActionType.FILE_RESET
})

/**
 * User accepted an incoming (large) file from the confirmation dialog.
 * Starts receiving and answers the sender with FILE_ACCEPT.
 */
export const acceptIncomingFile: (transferId: string) => (dispatch: Dispatch) => Promise<void>
    = (transferId: string) => (async (dispatch) => {
    const entry = pendingIncomingTransfers.get(transferId)
    if (!entry || entry.accepted) {
        log.warn('Cannot accept unknown/duplicate transfer: ' + transferId)
        return
    }

    entry.accepted = true
    log.info('Accepting incoming file transfer: ' + transferId)

    dispatch(filePendingRemove(transferId))
    dispatch(fileTransferStart({
        id: transferId,
        fileName: entry.metadata.fileName,
        fileSize: entry.metadata.fileSize,
        fileType: entry.metadata.fileType,
        peerId: entry.peerId,
        direction: 'receive',
        progress: 0,
        status: 'transferring',
    }))
    dispatch(addChatMessage(entry.peerId, {
        id: transferId,
        senderId: entry.peerId,
        content: entry.metadata.fileName,
        timestamp: Date.now(),
        type: entry.metadata.chatType,
        status: 'delivered',
        fileName: entry.metadata.fileName,
        fileSize: entry.metadata.fileSize,
        fileType: entry.metadata.fileType,
        transferId,
    } as ChatMessage))

    try {
        // Encrypted like every other FILE control message when a session key
        // exists (the sender falls back to the plaintext envelope for legacy
        // peers), consistent with the auto-accept path in receiveData.ts.
        await sendFileControlMessage(entry.peerId, transferId, 'FILE_ACCEPT', {
            encryptionEnabled: store.getState().settings.encryptionEnabled,
        })
    } catch (err) {
        log.error('Failed to send FILE_ACCEPT', err)
        dispatch(fileTransferError(transferId, 'Failed to answer sender'))
    }
})

/**
 * User rejected an incoming (large) file from the confirmation dialog.
 */
export const rejectIncomingFile: (transferId: string) => (dispatch: Dispatch) => Promise<void>
    = (transferId: string) => (async (dispatch) => {
    const entry = pendingIncomingTransfers.get(transferId)
    if (!entry || entry.accepted) {
        log.warn('Cannot reject unknown/duplicate transfer: ' + transferId)
        return
    }

    log.info('Rejecting incoming file transfer: ' + transferId)
    clearTransferState(transferId)
    dispatch(filePendingRemove(transferId))

    try {
        // Encrypted like every other FILE control message when a session key
        // exists (the sender falls back to the plaintext envelope for legacy
        // peers), consistent with the auto-accept path in receiveData.ts.
        await sendFileControlMessage(entry.peerId, transferId, 'FILE_REJECT', {
            encryptionEnabled: store.getState().settings.encryptionEnabled,
        })
    } catch (err) {
        log.error('Failed to send FILE_REJECT', err)
    }
})
