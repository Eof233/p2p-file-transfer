import { createLogger } from './logService'

const log = createLogger('Crypto')

export interface EncryptedData {
    iv: Uint8Array<ArrayBuffer>
    data: ArrayBuffer
}

export interface RSAKeyPair {
    publicKey: CryptoKey
    privateKey: CryptoKey
}

/** Lexicographic byte comparison used to sort raw public keys for HKDF info. */
const compareBytes = (a: Uint8Array, b: Uint8Array): number => {
    const len = Math.min(a.byteLength, b.byteLength)
    for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) return a[i] - b[i]
    }
    return a.byteLength - b.byteLength
}

export const CryptoService = {
    // Encoding helpers

    bufferToBase64: (buf: ArrayBuffer): string => {
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
    },

    base64ToBuffer: (b64: string): ArrayBuffer => {
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return bytes.buffer
    },

    // RSA Key Management

    generateKeyPair: async (): Promise<RSAKeyPair> => {
        log.debug('Generating RSA key pair')
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'RSA-OAEP',
                modulusLength: 2048,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256',
            },
            true,
            ['encrypt', 'decrypt']
        )
        return {
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey,
        }
    },

    exportPublicKey: async (key: CryptoKey): Promise<string> => {
        log.debug('Exporting public key')
        const spkiBuffer = await window.crypto.subtle.exportKey('spki', key)
        const bytes = new Uint8Array(spkiBuffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
    },

    importPublicKey: async (keyData: string): Promise<CryptoKey> => {
        log.debug('Importing public key')
        const binary = atob(keyData)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }
        return window.crypto.subtle.importKey(
            'spki',
            bytes.buffer,
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256',
            },
            true,
            ['encrypt']
        )
    },

    generateFingerprint: async (publicKey: CryptoKey): Promise<string> => {
        const spkiBuffer = await window.crypto.subtle.exportKey('spki', publicKey)
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', spkiBuffer)
        const hashBytes = new Uint8Array(hashBuffer)
        return Array.from(hashBytes)
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(':')
    },

    // ECDH Key Management (ephemeral P-256, one pair per connection)
    //
    // Perfect Forward Secrecy: each connection gets a fresh ephemeral ECDH
    // key pair. The public halves are exchanged over the wire; the private
    // halves stay local and are discarded on disconnect. The AES session key
    // is derived from the ECDH shared secret, so it never travels in a
    // recoverable form — even a compromised long-term RSA key cannot recover
    // historical session keys.

    generateEphemeralKeyPair: async (): Promise<CryptoKeyPair> => {
        log.debug('Generating ephemeral ECDH key pair')
        return window.crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'P-256',
            },
            true,
            ['deriveBits']
        )
    },

    exportEphemeralPublicKey: async (key: CryptoKey): Promise<string> => {
        log.debug('Exporting ephemeral public key')
        const raw = await window.crypto.subtle.exportKey('raw', key)
        return CryptoService.bufferToBase64(raw)
    },

    importEphemeralPublicKey: async (keyData: string): Promise<CryptoKey> => {
        log.debug('Importing ephemeral public key')
        return window.crypto.subtle.importKey(
            'raw',
            CryptoService.base64ToBuffer(keyData),
            {
                name: 'ECDH',
                namedCurve: 'P-256',
            },
            true,
            []
        )
    },

    /**
     * Derive the AES-256-GCM session key from an ECDH shared secret via
     * HKDF-SHA256. The HKDF info is domain-separated with both ephemeral
     * public keys (sorted lexicographically) and both long-term fingerprints,
     * so both sides derive the identical key regardless of who initiated.
     */
    deriveSharedSecret: async (
        privateKey: CryptoKey,
        peerPublicKey: CryptoKey,
        localPublicKey: CryptoKey,
        localFingerprint: string,
        peerFingerprint: string,
    ): Promise<CryptoKey> => {
        log.debug('Deriving shared secret via ECDH + HKDF-SHA256')
        const sharedBits = await window.crypto.subtle.deriveBits(
            {
                name: 'ECDH',
                public: peerPublicKey,
            },
            privateKey,
            256
        )

        // Domain separation: order-independent on both sides so the derived
        // key is the same no matter which side initiated the connection.
        const localRaw = new Uint8Array(await window.crypto.subtle.exportKey('raw', localPublicKey))
        const peerRaw = new Uint8Array(await window.crypto.subtle.exportKey('raw', peerPublicKey))
        const ephemeralKeys = [localRaw, peerRaw].sort(compareBytes)
        const fingerprints = [localFingerprint, peerFingerprint].sort()

        const encoder = new TextEncoder()
        const infoParts: Uint8Array[] = [
            ephemeralKeys[0],
            ephemeralKeys[1],
            encoder.encode(fingerprints[0]),
            encoder.encode(fingerprints[1]),
        ]
        const info = new Uint8Array(infoParts.reduce((total, part) => total + part.byteLength, 0))
        let offset = 0
        for (const part of infoParts) {
            info.set(part, offset)
            offset += part.byteLength
        }

        // HKDF requires the shared secret to be wrapped in an HKDF CryptoKey.
        const hkdfKey = await window.crypto.subtle.importKey(
            'raw',
            sharedBits,
            { name: 'HKDF' },
            false,
            ['deriveKey']
        )

        return window.crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: new Uint8Array(),
                info,
            },
            hkdfKey,
            {
                name: 'AES-GCM',
                length: 256,
            },
            true,
            ['encrypt', 'decrypt']
        )
    },

    // AES Session Key Management

    generateSessionKey: async (): Promise<CryptoKey> => {
        log.debug('Generating AES session key')
        return window.crypto.subtle.generateKey(
            {
                name: 'AES-GCM',
                length: 256,
            },
            true,
            ['encrypt', 'decrypt']
        )
    },

    encryptSessionKey: async (sessionKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> => {
        log.debug('Encrypting session key with RSA public key')
        const rawKey = await window.crypto.subtle.exportKey('raw', sessionKey)
        return window.crypto.subtle.encrypt(
            {
                name: 'RSA-OAEP',
            },
            publicKey,
            rawKey
        )
    },

    decryptSessionKey: async (encryptedKey: ArrayBuffer, privateKey: CryptoKey): Promise<CryptoKey> => {
        log.debug('Decrypting session key with RSA private key')
        const rawKey = await window.crypto.subtle.decrypt(
            {
                name: 'RSA-OAEP',
            },
            privateKey,
            encryptedKey
        )
        return window.crypto.subtle.importKey(
            'raw',
            rawKey,
            {
                name: 'AES-GCM',
                length: 256,
            },
            true,
            ['encrypt', 'decrypt']
        )
    },

    // Data Encryption/Decryption

    encrypt: async (data: ArrayBuffer, sessionKey: CryptoKey): Promise<EncryptedData> => {
        log.debug('Encrypting data, size: ' + data.byteLength + ' bytes')
        const iv = new Uint8Array(12)
        window.crypto.getRandomValues(iv)
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv,
            },
            sessionKey,
            data
        )
        return {
            iv,
            data: encryptedBuffer,
        }
    },

    decrypt: async (encryptedData: EncryptedData, sessionKey: CryptoKey): Promise<ArrayBuffer> => {
        log.debug('Decrypting data, size: ' + encryptedData.data.byteLength + ' bytes')
        return window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: encryptedData.iv,
            },
            sessionKey,
            encryptedData.data
        )
    },

    // Helper: encrypt string

    encryptString: async (text: string, sessionKey: CryptoKey): Promise<EncryptedData> => {
        const encoder = new TextEncoder()
        const encoded = encoder.encode(text)
        const data = new ArrayBuffer(encoded.byteLength)
        new Uint8Array(data).set(encoded)
        return CryptoService.encrypt(data, sessionKey)
    },

    // Helper: decrypt to string

    decryptToString: async (encryptedData: EncryptedData, sessionKey: CryptoKey): Promise<string> => {
        const decryptedBuffer = await CryptoService.decrypt(encryptedData, sessionKey)
        const decoder = new TextDecoder()
        return decoder.decode(decryptedBuffer)
    },
}
