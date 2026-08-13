import { CryptoService } from './cryptoService'
import { createLogger } from './logService'

const log = createLogger('Encryption')

/**
 * Wire format for encrypted payloads carried over the data channel.
 * All ciphertext is base64-encoded so it can travel inside JSON messages.
 */
export interface EncryptedPayload {
    iv: string       // base64-encoded AES-GCM IV (12 bytes)
    data: string     // base64-encoded ciphertext (including auth tag)
}

interface Session {
    sessionKey: CryptoKey
    remoteFingerprint: string
    verified: boolean
}

type Listener = () => void

/**
 * Singleton manager for the end-to-end encryption state.
 *
 * Lives at module scope (like PeerConnection) so every part of the app —
 * React hooks, Redux thunks, the shared receive handler — sees one key pair
 * and one set of per-peer session keys. Previously each useEncryption() call
 * generated its own RSA key pair, splitting state across components.
 */
class EncryptionManager {
    private keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null
    private fingerprint = ''
    private sessions = new Map<string, Session>()
    private listeners = new Set<Listener>()
    private version = 0
    private initPromise: Promise<void> | null = null

    // --- React subscription (useSyncExternalStore) ---

    getVersion = (): number => this.version

    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notify(): void {
        this.version++
        this.listeners.forEach((l) => l())
    }

    // --- Initialization ---

    /** Lazily generate the RSA-2048 key pair. Safe to call from anywhere, multiple times. */
    init = async (): Promise<void> => {
        if (this.keyPair) return
        if (this.initPromise) return this.initPromise
        this.initPromise = (async () => {
            try {
                log.info('Generating RSA key pair')
                const keys = await CryptoService.generateKeyPair()
                this.keyPair = keys
                this.fingerprint = await CryptoService.generateFingerprint(keys.publicKey)
                log.info('RSA key pair ready')
                this.notify()
            } catch (err) {
                this.initPromise = null
                log.error('Failed to generate RSA key pair', err)
                throw err
            }
        })()
        return this.initPromise
    }

    isReady = (): boolean => this.keyPair !== null

    getFingerprint = (): string => this.fingerprint

    async getPublicKeyBase64(): Promise<string> {
        if (!this.keyPair) throw new Error('Encryption not initialized')
        return CryptoService.exportPublicKey(this.keyPair.publicKey)
    }

    // --- Session keys ---

    /**
     * Initiator side: create a fresh AES-256 session key and encrypt it with
     * the peer's RSA public key. Returns the base64 ciphertext to send.
     */
    async createSessionKey(peerId: string, peerPublicKeyB64: string): Promise<string> {
        if (!this.keyPair) throw new Error('Encryption not initialized')
        const peerKey = await CryptoService.importPublicKey(peerPublicKeyB64)
        const sessionKey = await CryptoService.generateSessionKey()
        const remoteFingerprint = await CryptoService.generateFingerprint(peerKey)
        const encryptedKey = await CryptoService.encryptSessionKey(sessionKey, peerKey)
        this.sessions.set(peerId, { sessionKey, remoteFingerprint, verified: false })
        log.info('Session key established with peer: ' + peerId)
        this.notify()
        return CryptoService.bufferToBase64(encryptedKey)
    }

    /**
     * Receiver side: decrypt the session key sent by the connection initiator.
     */
    async receiveSessionKey(peerId: string, encryptedKeyB64: string, peerPublicKeyB64: string): Promise<void> {
        if (!this.keyPair) throw new Error('Encryption not initialized')
        const peerKey = await CryptoService.importPublicKey(peerPublicKeyB64)
        const remoteFingerprint = await CryptoService.generateFingerprint(peerKey)
        const encryptedKey = CryptoService.base64ToBuffer(encryptedKeyB64)
        const sessionKey = await CryptoService.decryptSessionKey(encryptedKey, this.keyPair.privateKey)
        this.sessions.set(peerId, { sessionKey, remoteFingerprint, verified: false })
        log.info('Session key received from peer: ' + peerId)
        this.notify()
    }

    hasSessionKey = (peerId: string): boolean => this.sessions.has(peerId)

    getRemoteFingerprint = (peerId: string): string =>
        this.sessions.get(peerId)?.remoteFingerprint ?? ''

    markVerified = (peerId: string): void => {
        const session = this.sessions.get(peerId)
        if (session) {
            session.verified = true
            this.notify()
        }
    }

    isVerified = (peerId: string): boolean => this.sessions.get(peerId)?.verified ?? false

    /** Drop per-peer session material when the connection closes. */
    removeSession = (peerId: string): void => {
        if (this.sessions.delete(peerId)) {
            log.info('Session key discarded for peer: ' + peerId)
            this.notify()
        }
    }

    // --- Per-message encryption ---

    async encryptString(peerId: string, text: string): Promise<EncryptedPayload> {
        const session = this.sessions.get(peerId)
        if (!session) throw new Error('No session key for peer: ' + peerId)
        const encrypted = await CryptoService.encryptString(text, session.sessionKey)
        return {
            iv: CryptoService.bufferToBase64(encrypted.iv.buffer as ArrayBuffer),
            data: CryptoService.bufferToBase64(encrypted.data),
        }
    }

    async decryptString(peerId: string, payload: EncryptedPayload): Promise<string> {
        const session = this.sessions.get(peerId)
        if (!session) throw new Error('No session key for peer: ' + peerId)
        const iv = new Uint8Array(CryptoService.base64ToBuffer(payload.iv))
        const encrypted = await CryptoService.decryptToString(
            { iv, data: CryptoService.base64ToBuffer(payload.data) },
            session.sessionKey,
        )
        return encrypted
    }

    async encryptBytes(peerId: string, bytes: ArrayBuffer): Promise<EncryptedPayload> {
        const session = this.sessions.get(peerId)
        if (!session) throw new Error('No session key for peer: ' + peerId)
        const encrypted = await CryptoService.encrypt(bytes, session.sessionKey)
        return {
            iv: CryptoService.bufferToBase64(encrypted.iv.buffer as ArrayBuffer),
            data: CryptoService.bufferToBase64(encrypted.data),
        }
    }

    async decryptBytes(peerId: string, payload: EncryptedPayload): Promise<ArrayBuffer> {
        const session = this.sessions.get(peerId)
        if (!session) throw new Error('No session key for peer: ' + peerId)
        const iv = new Uint8Array(CryptoService.base64ToBuffer(payload.iv))
        return CryptoService.decrypt(
            { iv, data: CryptoService.base64ToBuffer(payload.data) },
            session.sessionKey,
        )
    }
}

export const encryptionManager = new EncryptionManager()
