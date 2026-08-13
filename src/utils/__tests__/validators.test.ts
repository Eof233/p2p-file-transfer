import { describe, it, expect } from 'vitest'
import { validatePeerId, validateMessage, validateFile, isValidUrl } from '../validators'

describe('validators', () => {
    it('validatePeerId accepts non-empty trimmed ids', () => {
        expect(validatePeerId('peer-123')).toBe(true)
        expect(validatePeerId('  ')).toBe(false)
        expect(validatePeerId('')).toBe(false)
    })

    it('validateMessage rejects empty and over-long messages', () => {
        expect(validateMessage('hello')).toEqual({ valid: true })
        expect(validateMessage('   ').valid).toBe(false)
        expect(validateMessage('x'.repeat(101), 100).valid).toBe(false)
        expect(validateMessage('x'.repeat(100), 100).valid).toBe(true)
    })

    it('validateFile enforces size and type limits', () => {
        const big = new File([new Uint8Array(2000)], 'big.bin', { type: 'application/octet-stream' })
        const png = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })

        expect(validateFile(big, 1000).valid).toBe(false)
        expect(validateFile(big, 3000).valid).toBe(true)

        expect(validateFile(png, 1000, ['image/*']).valid).toBe(true)
        expect(validateFile(big, 3000, ['image/*']).valid).toBe(false)
        expect(validateFile(big, 3000).valid).toBe(true)
    })

    it('isValidUrl checks URL shape', () => {
        expect(isValidUrl('https://example.com/a?b=1')).toBe(true)
        expect(isValidUrl('not a url')).toBe(false)
    })
})
