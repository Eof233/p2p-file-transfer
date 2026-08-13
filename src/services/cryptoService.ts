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
