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

/** Per-connection ephemeral ECDH (P-256) key pair used for PFS. */
interface EphemeralKeyPair {
    pair: CryptoKeyPair
    publicKeyBase64: string
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
    private ephemeralKeys = new Map<string, EphemeralKeyPair>()
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

    // --- Perfect Forward Secrecy (ephemeral ECDH) ---
    //
    // The RSA key pair above stays as the long-term identity for fingerprint
    // verification, but the session key is now derived per connection from
    // ephemeral ECDH (P-256) key pairs instead of being wrapped in RSA. The
    // private halves never leave this machine and are discarded on disconnect,
    // so a compromised long-term RSA key cannot recover historical sessions.

    /**
     * Create a fresh ephemeral ECDH key pair for a connection and return the
     * public half (base64 raw) to advertise to the peer.
     */
    async createEphemeralKeyPair(peerId: string): Promise<string> {
        if (!this.keyPair) throw new Error('Encryption not initialized')
        const pair = await CryptoService.generateEphemeralKeyPair()
        const publicKeyBase64 = await CryptoService.exportEphemeralPublicKey(pair.publicKey)
        this.ephemeralKeys.set(peerId, { pair, publicKeyBase64 })
        log.info('Ephemeral ECDH key pair created for peer: ' + peerId)
        return publicKeyBase64
    }

    getEphemeralPublicKeyBase64 = (peerId: string): string | undefined =>
        this.ephemeralKeys.get(peerId)?.publicKeyBase64

    /**
     * Derive the AES-256-GCM session key from our ephemeral private key and
     * the peer's ephemeral public key (ECDH + HKDF). Both sides call this with
     * the same inputs, so they end up with the identical key — no session key
     * ever travels over the wire.
     */
    async installSessionKeyFromEcdh(peerId: string, peerEphemeralPublicKeyBase64: string, peerFingerprint: string): Promise<void> {
        if (!this.keyPair) throw new Error('Encryption not initialized')
        const ephemeral = this.ephemeralKeys.get(peerId)
        if (!ephemeral) throw new Error('No ephemeral key pair for peer: ' + peerId)
        const peerEphemeralKey = await CryptoService.importEphemeralPublicKey(peerEphemeralPublicKeyBase64)
        const sessionKey = await CryptoService.deriveSharedSecret(
            ephemeral.pair.privateKey,
            peerEphemeralKey,
            ephemeral.pair.publicKey,
            this.fingerprint,
            peerFingerprint,
        )
        this.sessions.set(peerId, { sessionKey, remoteFingerprint: peerFingerprint, verified: false })
        log.info('ECDH session key established with peer: ' + peerId)
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

    /**
     * Drop per-peer session material (and the ephemeral ECDH key pair) when
     * the connection closes. Discarding the ephemeral private key is what
     * gives the protocol forward secrecy.
     */
    removeSession = (peerId: string): void => {
        const hadSession = this.sessions.delete(peerId)
        const hadEphemeral = this.ephemeralKeys.delete(peerId)
        if (hadSession || hadEphemeral) {
            log.info('Session key discarded for peer: ' + peerId)
            this.notify()
        }
    }

    /** Drop ALL session and ephemeral-key material (session stop). */
    clearAllSessions = (): void => {
        const hadAny = this.sessions.size > 0 || this.ephemeralKeys.size > 0
        this.sessions.clear()
        this.ephemeralKeys.clear()
        if (hadAny) {
            log.info('Cleared all session keys and ephemeral key pairs')
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
