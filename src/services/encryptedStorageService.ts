import { STORAGE_KEYS } from '../utils/constants'

// Encrypted localStorage wrapper (AES-256-GCM via Web Crypto).
//
// SECURITY NOTE: the AES key is generated once per browser and stored in
// localStorage right next to the data it protects. This only guards against
// casual inspection of the raw stored values (e.g. peeking at devtools or a
// dumped storage file); it is NOT hardware-grade security. Anyone with full
// access to this browser profile, an XSS payload or a malicious extension can
// read the key and decrypt everything, so this must not be presented as a
// vault. It is deliberate obfuscation at rest.
//
// The service degrades gracefully: when Web Crypto or localStorage is
// unavailable it transparently falls back to plaintext storage, and values
// written by older versions (plaintext) are read back untouched.

const KEY_STORAGE_KEY = 'p2p-messenger-storage-key'

// On-disk format for encrypted values: JSON { v: 1, iv: <base64>, data: <base64> }
const FORMAT_VERSION = 1

interface EncryptedValue {
    v: number
    iv: string
    data: string
}

const bufferToBase64 = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
}

const base64ToBuffer = (b64: string): ArrayBuffer => {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
}

/** True when the raw value matches our { v, iv, data } envelope. */
const looksLikeEnvelope = (raw: string): boolean => {
    if (raw.length === 0 || raw[0] !== '{') return false
    try {
        const parsed = JSON.parse(raw) as Partial<EncryptedValue>
        return parsed.v === FORMAT_VERSION
            && typeof parsed.iv === 'string'
            && typeof parsed.data === 'string'
    } catch {
        return false
    }
}

const isStorageAvailable = (): boolean => {
    try {
        const testKey = '__encrypted_storage_test__'
        localStorage.setItem(testKey, '1')
        localStorage.removeItem(testKey)
        return true
    } catch {
        return false
    }
}

const generateKey = async (): Promise<CryptoKey> =>
    window.crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt']
    )

const importKey = async (b64: string): Promise<CryptoKey> =>
    window.crypto.subtle.importKey(
        'raw',
        base64ToBuffer(b64),
        {
            name: 'AES-GCM',
            length: 256,
        },
        true,
        ['encrypt', 'decrypt']
    )

const exportKey = async (key: CryptoKey): Promise<string> =>
    bufferToBase64(await window.crypto.subtle.exportKey('raw', key))

class EncryptedStorageService {
    private key: CryptoKey | null = null
    private enabled = false
    private available = false
    private initPromise: Promise<void> | null = null
    private managedKeys: Set<string> = new Set()

    /**
     * Generate (or load) the per-browser AES key and read the enabled flag
     * from the plaintext settings value. Idempotent; every public method
     * awaits this before touching storage, so explicit calls are optional.
     */
    init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.doInit()
        }
        return this.initPromise
    }

    private async doInit(): Promise<void> {
        // Fall back to plaintext storage when Web Crypto or localStorage is
        // unavailable (non-secure context, test environment, ...).
        this.available = typeof window !== 'undefined'
            && !!window.crypto?.subtle
            && isStorageAvailable()
        if (!this.available) {
            this.enabled = false
            return
        }

        try {
            const storedKey = localStorage.getItem(KEY_STORAGE_KEY)
            if (storedKey) {
                this.key = await importKey(storedKey)
            } else {
                this.key = await generateKey()
                localStorage.setItem(KEY_STORAGE_KEY, await exportKey(this.key))
            }
        } catch (err) {
            console.warn('EncryptedStorage: could not initialize storage key', err)
            this.available = false
            return
        }

        // The setting itself stays plaintext so it is readable before this
        // initialization runs; it is the source of truth for the flag.
        try {
            const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS)
            if (storedSettings) {
                this.enabled = !!JSON.parse(storedSettings).encryptLocalData
            }
        } catch {
            this.enabled = false
        }
    }

    /** Current encryption state (may lag behind init() until it resolves). */
    isEnabled(): boolean {
        return this.enabled
    }

    /**
     * Turn encryption on or off. Re-stores every managed key in the new mode:
     * enabling encrypts any legacy plaintext values, disabling converts
     * encrypted envelopes back to plaintext, so toggling is lossless.
     */
    async setEnabled(enabled: boolean): Promise<void> {
        await this.init()
        // Without Web Crypto we cannot encrypt; stay disabled and keep all
        // writes plaintext rather than pretending the data is protected.
        if (!this.available) return
        if (this.enabled === enabled) return
        this.enabled = enabled
        await this.reStoreManagedKeys()
    }

    /** Read a value; legacy plaintext values are returned untouched. */
    async getItem(key: string): Promise<string | null> {
        await this.init()
        this.managedKeys.add(key)
        try {
            const raw = localStorage.getItem(key)
            if (raw === null) return null
            // Legacy plaintext value (written before encryption existed):
            // return it as-is so existing data survives the upgrade.
            if (!looksLikeEnvelope(raw)) return raw
            if (!this.available || !this.key) return null
            try {
                return await this.decryptValue(raw)
            } catch (err) {
                console.warn('EncryptedStorage: failed to decrypt value for key ' + key, err)
                return null
            }
        } catch (err) {
            console.warn('EncryptedStorage: read failed for key ' + key, err)
            return null
        }
    }

    /** Write a value, encrypted when enabled, plaintext otherwise. */
    async setItem(key: string, value: string): Promise<void> {
        await this.init()
        this.managedKeys.add(key)
        try {
            if (!this.available || !this.enabled || !this.key) {
                localStorage.setItem(key, value)
                return
            }
            try {
                localStorage.setItem(key, JSON.stringify(await this.encryptValue(value)))
                return
            } catch (err) {
                console.warn('EncryptedStorage: encrypted write failed for key ' + key
                    + ', falling back to plaintext', err)
            }
            localStorage.setItem(key, value)
        } catch (err) {
            console.warn('EncryptedStorage: write failed for key ' + key, err)
        }
    }

    async removeItem(key: string): Promise<void> {
        await this.init()
        this.managedKeys.delete(key)
        try {
            localStorage.removeItem(key)
        } catch (err) {
            console.warn('EncryptedStorage: remove failed for key ' + key, err)
        }
    }

    private async encryptValue(plaintext: string): Promise<EncryptedValue> {
        const iv = new Uint8Array(12)
        window.crypto.getRandomValues(iv)
        const encoded = new TextEncoder().encode(plaintext)
        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv,
            },
            this.key as CryptoKey,
            encoded
        )
        return {
            v: FORMAT_VERSION,
            iv: bufferToBase64(iv.buffer),
            data: bufferToBase64(ciphertext),
        }
    }

    private async decryptValue(envelope: string): Promise<string> {
        const parsed = JSON.parse(envelope) as EncryptedValue
        const plaintext = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: base64ToBuffer(parsed.iv),
            },
            this.key as CryptoKey,
            base64ToBuffer(parsed.data)
        )
        return new TextDecoder().decode(plaintext)
    }

    private async reStoreManagedKeys(): Promise<void> {
        for (const key of this.managedKeys) {
            try {
                const raw = localStorage.getItem(key)
                if (raw === null) continue
                if (this.enabled) {
                    if (!looksLikeEnvelope(raw)) {
                        localStorage.setItem(key, JSON.stringify(await this.encryptValue(raw)))
                    }
                } else if (looksLikeEnvelope(raw)) {
                    const decrypted = await this.decryptValue(raw)
                    localStorage.setItem(key, decrypted)
                }
            } catch (err) {
                console.warn('EncryptedStorage: failed to re-store key ' + key, err)
            }
        }
    }
}

// Singleton instance shared by the whole app (same pattern as logService).
export const encryptedStorage = new EncryptedStorageService()
