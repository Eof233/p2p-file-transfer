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

    describe('ECDH session keys (perfect forward secrecy)', () => {
        it('derives the same session key on both sides without a wire key', async () => {
            // Each side creates its own ephemeral pair and installs the other
            // side's public half — exactly what the handshake does.
            const ephA = await encryptionManager.createEphemeralKeyPair('ecdhA')
            const ephB = await encryptionManager.createEphemeralKeyPair('ecdhB')
            expect(encryptionManager.getEphemeralPublicKeyBase64('ecdhA')).toBe(ephA)

            const fp = encryptionManager.getFingerprint()
            await encryptionManager.installSessionKeyFromEcdh('ecdhA', ephB, fp)
            await encryptionManager.installSessionKeyFromEcdh('ecdhB', ephA, fp)

            expect(encryptionManager.hasSessionKey('ecdhA')).toBe(true)
            expect(encryptionManager.hasSessionKey('ecdhB')).toBe(true)
            expect(encryptionManager.getRemoteFingerprint('ecdhA')).toBe(fp)

            // Encrypt on A, decrypt on B: the derived keys must match.
            const plain = 'pfs over ecdh'
            const enc = await encryptionManager.encryptString('ecdhA', plain)
            expect(await encryptionManager.decryptString('ecdhB', enc)).toBe(plain)
        })

        it('rejects messages when the ephemeral public keys do not match', async () => {
            await encryptionManager.createEphemeralKeyPair('mismatchA')
            const ephB = await encryptionManager.createEphemeralKeyPair('mismatchB')
            const ephC = await encryptionManager.createEphemeralKeyPair('mismatchC')
            const fp = encryptionManager.getFingerprint()

            await encryptionManager.installSessionKeyFromEcdh('mismatchA', ephB, fp)
            // B installs with C's public key, so its derived key differs.
            await encryptionManager.installSessionKeyFromEcdh('mismatchB', ephC, fp)

            const enc = await encryptionManager.encryptString('mismatchA', 'secret')
            await expect(encryptionManager.decryptString('mismatchB', enc)).rejects.toThrow()
        })

        it('throws when installing an ECDH session without an ephemeral pair', async () => {
            await expect(
                encryptionManager.installSessionKeyFromEcdh('ghostEcdh', 'AAAA', 'FP'),
            ).rejects.toThrow(/No ephemeral key pair/)
        })

        it('discards ephemeral keys on disconnect and session stop', async () => {
            await encryptionManager.createEphemeralKeyPair('cleanupPeer')
            expect(encryptionManager.getEphemeralPublicKeyBase64('cleanupPeer')).toBeDefined()

            // removeSession (called on connection close) drops both the
            // session key and the ephemeral pair.
            encryptionManager.removeSession('cleanupPeer')
            expect(encryptionManager.getEphemeralPublicKeyBase64('cleanupPeer')).toBeUndefined()
            expect(encryptionManager.hasSessionKey('cleanupPeer')).toBe(false)

            // clearAllSessions (called on session stop) drops everything.
            await encryptionManager.createEphemeralKeyPair('cleanupPeer2')
            encryptionManager.clearAllSessions()
            expect(encryptionManager.getEphemeralPublicKeyBase64('cleanupPeer2')).toBeUndefined()
            expect(encryptionManager.hasSessionKey('cleanupPeer2')).toBe(false)
        })
    })
})
