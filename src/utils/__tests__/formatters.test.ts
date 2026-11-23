import { describe, it, expect } from 'vitest'
import {
    formatFileSize,
    formatSpeed,
    formatDuration,
    formatTime,
    formatDate,
    truncateId,
} from '../formatters'

describe('formatters', () => {
    it('formatFileSize formats bytes across units', () => {
        expect(formatFileSize(0)).toBe('0 B')
        expect(formatFileSize(1023)).toBe('1023 B')
        expect(formatFileSize(1024)).toBe('1 KB')
        expect(formatFileSize(1536)).toBe('1.5 KB')
        expect(formatFileSize(2 * 1024 * 1024)).toBe('2 MB')
        expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3 GB')
    })

    it('formatFileSize never falls off the unit table', () => {
        expect(formatFileSize(0.5)).toBe('0.5 B')
        expect(formatFileSize(2 * 1024 ** 4)).toBe('2 TB')
        expect(formatFileSize(3 * 1024 ** 5)).toBe('3072 TB')
        expect(formatFileSize(-1)).toBe('0 B')
        expect(formatFileSize(NaN)).toBe('0 B')
        expect(formatSpeed(0.5)).toBe('0.5 B/s')
    })

    it('formatDuration never shows a 60s component', () => {
        expect(formatDuration(59.5)).toBe('1m 0s')
        expect(formatDuration(119.2)).toBe('2m 0s')
        expect(formatDuration(3599.5)).toBe('1h 0m')
    })

    it('formatSpeed appends /s', () => {
        expect(formatSpeed(1024)).toBe('1 KB/s')
        expect(formatSpeed(0)).toBe('0 B/s')
    })

    it('formatDuration handles seconds, minutes, hours and Infinity', () => {
        expect(formatDuration(Infinity)).toBe('∞')
        expect(formatDuration(0)).toBe('0s')
        expect(formatDuration(45)).toBe('45s')
        expect(formatDuration(90)).toBe('1m 30s')
        expect(formatDuration(3661)).toBe('1h 1m')
    })

    it('truncateId shortens long ids only', () => {
        expect(truncateId('abc', 8)).toBe('abc')
        expect(truncateId('0123456789abcdef', 8)).toBe('01234567...')
    })

    it('formatTime produces HH:MM (24h or 12h, depending on locale)', () => {
        const result = formatTime(new Date(2026, 0, 1, 9, 5).getTime())
        // en-US style "09:05 AM", 24h style "09:05", or similar locales
        expect(result).toMatch(/^\d{1,2}:\d{2}([ \u00A0](AM|PM))?$/i)
    })

    it('formatDate distinguishes today/yesterday/other', () => {
        const now = new Date()
        expect(formatDate(now.getTime())).toBe('Today')

        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        expect(formatDate(yesterday.getTime())).toBe('Yesterday')

        const older = new Date(2020, 0, 1)
        expect(formatDate(older.getTime())).not.toBe('Today')
        expect(formatDate(older.getTime())).not.toBe('Yesterday')
    })
})
