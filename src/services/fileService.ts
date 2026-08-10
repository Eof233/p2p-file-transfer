import { createLogger } from './logService'

const log = createLogger('File')

export interface FileChunk {
    index: number
    total: number
    data: ArrayBuffer
    fileName: string
    fileType: string
    fileSize: number
    transferId: string
}

const DEFAULT_CHUNK_SIZE = 16 * 1024  // 16KB chunks for WebRTC data channel

export const FileService = {
    // Split file into chunks for transfer
    chunkFile: async (file: File, transferId: string, chunkSize: number = DEFAULT_CHUNK_SIZE): Promise<FileChunk[]> => {
        const chunks: FileChunk[] = []
        const totalChunks = Math.ceil(file.size / chunkSize)
        log.debug('Chunking file: ' + file.name + ', size: ' + file.size + ', chunks: ' + totalChunks)

        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize
            const end = Math.min(start + chunkSize, file.size)
            const data = await file.slice(start, end).arrayBuffer()
            chunks.push({
                index: i,
                total: totalChunks,
                data,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                transferId,
            })
        }
        return chunks
    },

    // Reassemble chunks into a Blob
    reassembleChunks: (chunks: FileChunk[]): Blob => {
        log.debug('Reassembling chunks, count: ' + chunks.length)
        // Sort by index, combine data
        const sorted = [...chunks].sort((a, b) => a.index - b.index)
        return new Blob(sorted.map(c => c.data), { type: sorted[0].fileType })
    },

    // Validate file size
    validateFileSize: (file: File, maxSize: number): boolean => {
        const valid = file.size <= maxSize
        log.debug('Validating file size: ' + file.name + ', size: ' + file.size + ', max: ' + maxSize + ', valid: ' + valid)
        return valid
    },

    // Validate file type
    validateFileType: (file: File, allowedTypes: string[]): boolean => {
        if (allowedTypes.length === 0) return true
        return allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.replace('/*', '/'))
            }
            return file.type === type
        })
    },

    // Format file size for display
    formatFileSize: (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    },

    // Calculate transfer speed
    calculateSpeed: (bytesTransferred: number, elapsedMs: number): number => {
        if (elapsedMs === 0) return 0
        return (bytesTransferred / elapsedMs) * 1000  // bytes per second
    },

    // Estimate remaining time
    estimateRemaining: (bytesRemaining: number, speedBps: number): number => {
        if (speedBps === 0) return Infinity
        return bytesRemaining / speedBps  // seconds
    },
}
