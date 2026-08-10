import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { FileTransfer, PendingFile } from '../store/file/fileTypes'
import {
    initiateFileTransfer,
    acceptFileTransfer,
    cancelFileTransfer,
    fileTransferError,
} from '../store/file/fileActions'

export const useFileTransfer = () => {
    const dispatch = useAppDispatch()

    // file and settings slices are not yet registered in the store; cast to access the expected shape
    const transfers = useAppSelector(
        (state: any) => (state.file?.transfers as Record<string, FileTransfer> | undefined) ?? {},
    )

    const pendingFiles = useAppSelector(
        (state: any) => (state.file?.pendingFiles as PendingFile[] | undefined) ?? [],
    )

    const selectedPeerId = useAppSelector((state) => state.connection.selectedId)

    const maxFileSize = useAppSelector(
        (state: any) => (state.settings?.maxFileSize as number | undefined) ?? 100 * 1024 * 1024,
    )

    const sendFile = useCallback(
        async (file: File) => {
            if (!selectedPeerId) {
                throw new Error('No peer selected')
            }

            if (file.size > maxFileSize) {
                const id = crypto.randomUUID()
                dispatch(
                    fileTransferError(
                        id,
                        `File size exceeds the maximum allowed size of ${Math.round(maxFileSize / (1024 * 1024))}MB`,
                    ),
                )
                return
            }

            dispatch(initiateFileTransfer(selectedPeerId, file) as any)
        },
        [selectedPeerId, maxFileSize, dispatch],
    )

    const acceptFile = useCallback(
        (transferId: string) => {
            dispatch(acceptFileTransfer(transferId))
        },
        [dispatch],
    )

    const cancelTransfer = useCallback(
        (transferId: string) => {
            dispatch(cancelFileTransfer(transferId))
        },
        [dispatch],
    )

    return {
        transfers,
        pendingFiles,
        sendFile,
        acceptFile,
        cancelTransfer,
    }
}
