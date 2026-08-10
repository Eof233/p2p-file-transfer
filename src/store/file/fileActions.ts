import {FileActionType, FileTransfer} from "./fileTypes";
import {Dispatch} from "redux";

export const fileTransferStart = (transfer: FileTransfer) => ({
    type: FileActionType.FILE_TRANSFER_START, ...transfer
})

export const fileTransferProgress = (id: string, progress: number, speed?: number) => ({
    type: FileActionType.FILE_TRANSFER_PROGRESS, id, progress, speed
})

export const fileTransferComplete = (id: string) => ({
    type: FileActionType.FILE_TRANSFER_COMPLETE, id
})

export const fileTransferCancel = (id: string) => ({
    type: FileActionType.FILE_TRANSFER_CANCEL, id
})

export const fileTransferError = (id: string, error: string) => ({
    type: FileActionType.FILE_TRANSFER_ERROR, id, error
})

export const filePendingAdd = (id: string, fileName: string, fileSize: number, fileType: string, peerId: string, blob?: Blob) => ({
    type: FileActionType.FILE_PENDING_ADD, id, fileName, fileSize, fileType, peerId, blob
})

export const filePendingRemove = (id: string) => ({
    type: FileActionType.FILE_PENDING_REMOVE, id
})

export const initiateFileTransfer: (peerId: string, file: File) => (dispatch: Dispatch) => void
    = (peerId: string, file: File) => ((dispatch) => {
    const id = crypto.randomUUID()
    const transfer: FileTransfer = {
        id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        peerId,
        direction: 'send',
        progress: 0,
        status: 'pending'
    }
    dispatch(fileTransferStart(transfer))
})

export const acceptFileTransfer: (transferId: string) => (dispatch: Dispatch) => void
    = (transferId: string) => ((dispatch) => {
    dispatch(fileTransferProgress(transferId, 0))
})

export const cancelFileTransfer: (transferId: string) => (dispatch: Dispatch) => void
    = (transferId: string) => ((dispatch) => {
    dispatch(fileTransferCancel(transferId))
})
