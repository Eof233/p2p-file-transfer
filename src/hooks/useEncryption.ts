import { useSyncExternalStore } from 'react'
import { encryptionManager } from '../services/encryptionService'

/**
 * React view over the EncryptionManager singleton.
 *
 * The singleton owns the RSA key pair and per-peer session keys, so every
 * component and Redux thunk shares one state. The hook only re-renders when
 * the manager notifies a change (version counter).
 */
export const useEncryption = () => {
    // version is read only to subscribe; values below are read directly
    useSyncExternalStore(encryptionManager.subscribe, encryptionManager.getVersion)

    return {
        fingerprint: encryptionManager.getFingerprint(),
        hasSessionKey: (peerId: string) => encryptionManager.hasSessionKey(peerId),
        getRemoteFingerprint: (peerId: string) => encryptionManager.getRemoteFingerprint(peerId),
        markPeerVerified: (peerId: string) => encryptionManager.markVerified(peerId),
        isPeerVerified: (peerId: string) => encryptionManager.isVerified(peerId),
    }
}
