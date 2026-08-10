import { useState, useEffect, useCallback } from 'react'
import { CryptoService, RSAKeyPair, EncryptedData } from '../services/cryptoService'

export const useEncryption = () => {
    const [keyPair, setKeyPair] = useState<RSAKeyPair | null>(null)
    const [sessionKeys, setSessionKeys] = useState<Record<string, CryptoKey>>({})
    const [fingerprint, setFingerprint] = useState<string>('')

    useEffect(() => {
        const init = async () => {
            try {
                const keys = await CryptoService.generateKeyPair()
                setKeyPair(keys)
                const fp = await CryptoService.generateFingerprint(keys.publicKey)
                setFingerprint(fp)
            } catch (err) {
                console.error('Failed to generate encryption key pair:', err)
            }
        }
        init()
    }, [])

    const getPublicKeyBase64 = useCallback(async (): Promise<string> => {
        if (!keyPair) return ''
        return CryptoService.exportPublicKey(keyPair.publicKey)
    }, [keyPair])

    const establishSession = useCallback(
        async (peerId: string, peerPublicKeyBase64: string): Promise<ArrayBuffer> => {
            if (!keyPair) throw new Error('Encryption not initialized')

            const peerKey = await CryptoService.importPublicKey(peerPublicKeyBase64)
            const sessionKey = await CryptoService.generateSessionKey()
            const encrypted = await CryptoService.encryptSessionKey(sessionKey, peerKey)

            setSessionKeys((prev) => ({ ...prev, [peerId]: sessionKey }))
            return encrypted
        },
        [keyPair],
    )

    const encryptForPeer = useCallback(
        async (peerId: string, data: string): Promise<EncryptedData> => {
            const key = sessionKeys[peerId]
            if (!key) throw new Error('No session key for peer')
            return CryptoService.encryptString(data, key)
        },
        [sessionKeys],
    )

    const decryptFromPeer = useCallback(
        async (peerId: string, data: EncryptedData): Promise<string> => {
            const key = sessionKeys[peerId]
            if (!key) throw new Error('No session key for peer')
            return CryptoService.decryptToString(data, key)
        },
        [sessionKeys],
    )

    const hasSessionKey = useCallback(
        (peerId: string): boolean => !!sessionKeys[peerId],
        [sessionKeys],
    )

    return {
        keyPair,
        fingerprint,
        getPublicKeyBase64,
        establishSession,
        encryptForPeer,
        decryptFromPeer,
        hasSessionKey,
    }
}
