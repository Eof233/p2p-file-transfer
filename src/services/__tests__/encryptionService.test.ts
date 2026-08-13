import { describe, it, expect } from 'vitest'
import { encryptionManager } from '../encryptionService'

/**
 * The manager is a singleton; these tests run sequentially and build on each
 * other's state (vitest runs tests within a file in order).
 */
describe('EncryptionManager', () => {
    it('initializes lazily and produces a fingerprint', async () => {
        await encryptionManager.init()
        expect(encryptionManager.isReady()).toBe(true)
        expect(encryptionManager.getFingerprint()).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)

        // second init is a no-op returning the same material
        const fp = encryptionManager.getFingerprint()
        await encryptionManager.init()
        expect(encryptionManager.getFingerprint()).toBe(fp)
    })

    it('exchanges a session key between initiator and receiver', async () => {
        const publicKey = await encryptionManager.getPublicKeyBase64()

        // Initiator encrypts a session key with the (simulated) peer's public key
        const keyData = await encryptionManager.createSessionKey('peerB', publicKey)
        expect(encryptionManager.hasSessionKey('peerB')).toBe(true)

        // Receiver decrypts it using the initiator's public key for fingerprinting
        await encryptionManager.receiveSessionKey('peerA', keyData, publicKey)
        expect(encryptionManager.hasSessionKey('peerA')).toBe(true)

        const remoteFp = encryptionManager.getRemoteFingerprint('peerB')
        expect(remoteFp).toBe(encryptionManager.getFingerprint())
    })

    it('encrypts/decrypts strings in both directions', async () => {
        const plain = JSON.stringify({ dataType: 'CHAT_MESSAGE', content: 'hello 🔐 世界' })
        const enc = await encryptionManager.encryptString('peerB', plain)
        expect(enc.data).not.toContain('hello')

        expect(await encryptionManager.decryptString('peerA', enc)).toBe(plain)

        const reply = await encryptionManager.encryptString('peerA', 'reply-42')
        expect(await encryptionManager.decryptString('peerB', reply)).toBe('reply-42')
    })

    it('encrypts/decrypts binary chunks', async () => {
        const chunk = new Uint8Array(16 * 1024)
        for (let i = 0; i < chunk.length; i++) chunk[i] = (i * 31) % 256

        const enc = await encryptionManager.encryptBytes('peerB', chunk.buffer)
        const dec = await encryptionManager.decryptBytes('peerA', enc)
        expect(dec.byteLength).toBe(chunk.byteLength)
        expect(Array.from(new Uint8Array(dec))).toEqual(Array.from(chunk))
    })

    it('rejects tampered ciphertext', async () => {
        const enc = await encryptionManager.encryptString('peerB', 'tamper me')
        await expect(
            encryptionManager.decryptString('peerA', { iv: enc.iv, data: 'AAAA' + enc.data.slice(4) }),
        ).rejects.toThrow()
    })

    it('throws for peers without a session key', async () => {
        await expect(encryptionManager.encryptString('ghost', 'x')).rejects.toThrow(/No session key/)
        await expect(
            encryptionManager.decryptString('ghost', { iv: 'AAAA', data: 'AAAA' }),
        ).rejects.toThrow(/No session key/)
    })

    it('verifies peers and removes sessions', () => {
        expect(encryptionManager.isVerified('peerB')).toBe(false)
        encryptionManager.markVerified('peerB')
        expect(encryptionManager.isVerified('peerB')).toBe(true)

        encryptionManager.removeSession('peerA')
        expect(encryptionManager.hasSessionKey('peerA')).toBe(false)
        expect(encryptionManager.hasSessionKey('peerB')).toBe(true)
    })
})
