import { describe, it, expect } from 'vitest'
import { CryptoService } from '../cryptoService'

describe('CryptoService', () => {
    it('generates RSA-2048 key pairs with the expected usages', async () => {
        const pair = await CryptoService.generateKeyPair()
        expect(pair.publicKey.algorithm.name).toBe('RSA-OAEP')
        expect(pair.publicKey.usages).toContain('encrypt')
        expect(pair.privateKey.usages).toContain('decrypt')
    })

    it('exports and imports public keys (base64 SPKI round trip)', async () => {
        const pair = await CryptoService.generateKeyPair()
        const exported = await CryptoService.exportPublicKey(pair.publicKey)
        expect(exported).toMatch(/^[A-Za-z0-9+/]+=*$/)
        expect(exported.length).toBeGreaterThan(300)

        const imported = await CryptoService.importPublicKey(exported)
        expect(imported.usages).toContain('encrypt')
    })

    it('generates a colon-separated SHA-256 fingerprint', async () => {
        const pair = await CryptoService.generateKeyPair()
        const fp = await CryptoService.generateFingerprint(pair.publicKey)
        expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)

        // deterministic for the same key
        const fp2 = await CryptoService.generateFingerprint(pair.publicKey)
        expect(fp2).toBe(fp)
    })

    it('base64 helpers round trip bytes losslessly', () => {
        const bytes = new Uint8Array([0, 1, 2, 127, 128, 200, 255])
        const encoded = CryptoService.bufferToBase64(bytes.buffer)
        const decoded = new Uint8Array(CryptoService.base64ToBuffer(encoded))
        expect(Array.from(decoded)).toEqual(Array.from(bytes))
    })

    it('AES-256-GCM string round trip', async () => {
        const key = await CryptoService.generateSessionKey()
        expect(key.algorithm.name).toBe('AES-GCM')

        const text = 'hello 🔐 世界 - secure p2p'
        const encrypted = await CryptoService.encryptString(text, key)
        expect(encrypted.iv.byteLength).toBe(12)
        expect(encrypted.data.byteLength).toBeGreaterThan(text.length)

        const decrypted = await CryptoService.decryptToString(encrypted, key)
        expect(decrypted).toBe(text)
    })

    it('rejects tampered ciphertext (GCM auth)', async () => {
        const key = await CryptoService.generateSessionKey()
        const encrypted = await CryptoService.encryptString('attack at dawn', key)

        const tampered = new Uint8Array(encrypted.data.slice(0))
        tampered[0] ^= 0xff

        await expect(
            CryptoService.decryptToString({ iv: encrypted.iv, data: tampered.buffer }, key),
        ).rejects.toThrow()
    })

    it('session key exchange: correct private key decrypts, wrong one fails', async () => {
        const alice = await CryptoService.generateKeyPair()
        const bob = await CryptoService.generateKeyPair()
        const sessionKey = await CryptoService.generateSessionKey()

        // Alice encrypts the session key for Bob
        const encryptedKey = await CryptoService.encryptSessionKey(sessionKey, bob.publicKey)

        // Bob decrypts and gets a usable AES key
        const bobKey = await CryptoService.decryptSessionKey(encryptedKey, bob.privateKey)
        expect(bobKey.algorithm.name).toBe('AES-GCM')
        const enc = await CryptoService.encryptString('shared secret', bobKey)
        expect(await CryptoService.decryptToString(enc, bobKey)).toBe('shared secret')

        // A wrong private key must fail
        await expect(CryptoService.decryptSessionKey(encryptedKey, alice.privateKey)).rejects.toThrow()
    })
})
