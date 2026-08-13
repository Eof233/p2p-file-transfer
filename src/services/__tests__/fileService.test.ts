import { describe, it, expect } from 'vitest'
import { FileService } from '../fileService'

describe('FileService', () => {
    describe('chunkFile', () => {
        it('splits a file into 16KB chunks with correct indexes', async () => {
            const size = 100 * 1024 // 100KB -> 7 chunks (6 full + 1 partial)
            const bytes = new Uint8Array(size)
            for (let i = 0; i < size; i++) bytes[i] = (i * 7) % 256
            const file = new File([bytes], 'test.bin', { type: 'application/octet-stream' })

            const chunks = await FileService.chunkFile(file, 'tf1', 16 * 1024)
            expect(chunks).toHaveLength(7)
            expect(chunks.map(c => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
            expect(chunks[0].data.byteLength).toBe(16 * 1024)
            expect(chunks[6].data.byteLength).toBe(size - 6 * 16 * 1024)
            expect(chunks.every(c => c.transferId === 'tf1')).toBe(true)
            expect(chunks.every(c => c.total === 7)).toBe(true)
        })

        it('handles zero-byte files', async () => {
            const chunks = await FileService.chunkFile(new File([], 'empty'), 'tf2')
            expect(chunks).toHaveLength(0)
        })

        it('handles files smaller than one chunk', async () => {
            const chunks = await FileService.chunkFile(new File(['hello'], 'small.txt'), 'tf3')
            expect(chunks).toHaveLength(1)
            expect(chunks[0].data.byteLength).toBe(5)
        })
    })

    describe('reassembleChunks', () => {
        it('sorts chunks by index and reassembles the original bytes', async () => {
            const size = 50 * 1024
            const bytes = new Uint8Array(size)
            for (let i = 0; i < size; i++) bytes[i] = (i * 13) % 256
            const file = new File([bytes], 'data.bin', { type: 'application/octet-stream' })

            const chunks = await FileService.chunkFile(file, 'tf4')
            // shuffle to prove sorting
            const shuffled = [...chunks].sort(() => 0.5 - Math.random())
            const blob = FileService.reassembleChunks(shuffled)

            expect(blob.type).toBe('application/octet-stream')
            expect(blob.size).toBe(size)
            expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(Array.from(bytes))
        })
    })

    describe('validation', () => {
        it('validateFileSize enforces the maximum', () => {
            const file = new File([new Uint8Array(1000)], 'f')
            expect(FileService.validateFileSize(file, 1024)).toBe(true)
            expect(FileService.validateFileSize(file, 999)).toBe(false)
        })

        it('validateFileType supports exact and wildcard matches', () => {
            const png = new File(['x'], 'a.png', { type: 'image/png' })
            const txt = new File(['x'], 'a.txt', { type: 'text/plain' })

            expect(FileService.validateFileType(png, ['image/*'])).toBe(true)
            expect(FileService.validateFileType(txt, ['image/*'])).toBe(false)
            expect(FileService.validateFileType(txt, ['text/plain'])).toBe(true)
            expect(FileService.validateFileType(txt, [])).toBe(true)
        })
    })

    describe('formatting and estimates', () => {
        it('formatFileSize handles all units', () => {
            expect(FileService.formatFileSize(0)).toBe('0 B')
            expect(FileService.formatFileSize(1023)).toBe('1023 B')
            expect(FileService.formatFileSize(1024)).toBe('1 KB')
            expect(FileService.formatFileSize(1536)).toBe('1.5 KB')
            expect(FileService.formatFileSize(5 * 1024 * 1024)).toBe('5 MB')
        })

        it('calculateSpeed returns bytes per second', () => {
            expect(FileService.calculateSpeed(0, 1000)).toBe(0)
            expect(FileService.calculateSpeed(2000, 2000)).toBe(1000)
        })

        it('estimateRemaining returns seconds or Infinity', () => {
            expect(FileService.estimateRemaining(1000, 0)).toBe(Infinity)
            expect(FileService.estimateRemaining(2000, 1000)).toBe(2)
        })
    })
})
