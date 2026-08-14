import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendFileControlMessage, decryptFileControl } from '../transferCoordinator'
import { PeerConnection, DataType, Data } from '../../../helpers/peer'
import { encryptionManager } from '../../../services/encryptionService'

/**
 * FILE control messages (FILE_ACCEPT/REJECT/CANCEL/COMPLETE/MISSING) are now
 * encrypted like FILE_START metadata when a session key exists and encryption
 * is enabled, with a legacy plaintext fallback for old peers.
 */
describe('FILE control message encryption', () => {
    beforeEach(async () => {
        // Route sends through a mock so we can inspect the wire envelope
        vi.spyOn(PeerConnection, 'sendConnection').mockResolvedValue(undefined)
        await encryptionManager.init()
        if (!encryptionManager.hasSessionKey('peerX')) {
            const publicKey = await encryptionManager.getPublicKeyBase64()
            await encryptionManager.createSessionKey('peerX', publicKey)
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const lastSent = (): Data => {
        const calls = vi.mocked(PeerConnection.sendConnection).mock.calls
        return calls[calls.length - 1][1]
    }

    it('encrypts a FILE control message and decrypts it on the receiving side', async () => {
        await sendFileControlMessage('peerX', 't1', 'FILE_ACCEPT', { encryptionEnabled: true })

        expect(vi.mocked(PeerConnection.sendConnection)).toHaveBeenCalledTimes(1)
        const sent = lastSent()
        expect(sent.dataType).toBe(DataType.FILE)
        expect(sent.message).toBe('FILE_ACCEPT')
        expect(sent.transferId).toBe('t1')
        expect(sent.encrypted).toBe(true)
        expect(sent.iv).toBeTruthy()
        expect(sent.payload).toBeTruthy()

        // Receiver-side round trip: decrypt the JSON body back out of the payload
        const body = await decryptFileControl('peerX', sent)
        expect(body).not.toBeNull()
        expect(body?.message).toBe('FILE_ACCEPT')
        expect(body?.transferId).toBe('t1')
    })

    it('carries extra fields (FILE_MISSING chunk list) through the encrypted round trip', async () => {
        await sendFileControlMessage('peerX', 't2', 'FILE_MISSING', {
            encryptionEnabled: true,
            extra: { missingChunks: [1, 3, 7] },
        })

        const body = await decryptFileControl('peerX', lastSent())
        expect(body).not.toBeNull()
        expect(body?.missingChunks).toEqual([1, 3, 7])
    })

    it('sends legacy plaintext when encryption is disabled', async () => {
        await sendFileControlMessage('peerX', 't3', 'FILE_REJECT', { encryptionEnabled: false })

        const sent = lastSent()
        expect(sent.encrypted).toBeUndefined()
        expect(sent.iv).toBeUndefined()
        expect(sent.payload).toBeUndefined()
        expect(sent.dataType).toBe(DataType.FILE)
        expect(sent.message).toBe('FILE_REJECT')
        expect(sent.transferId).toBe('t3')
    })

    it('sends legacy plaintext when no session key exists', async () => {
        await sendFileControlMessage('ghostPeer', 't4', 'FILE_CANCEL', { encryptionEnabled: true })

        const sent = lastSent()
        expect(sent.encrypted).toBeUndefined()
        expect(sent.message).toBe('FILE_CANCEL')
        expect(sent.transferId).toBe('t4')
    })

    it('carries extra fields as envelope fields on the legacy plaintext path', async () => {
        await sendFileControlMessage('peerX', 't5', 'FILE_MISSING', {
            encryptionEnabled: false,
            extra: { missingChunks: [2, 4] },
        })

        const sent = lastSent()
        expect(sent.encrypted).toBeUndefined()
        expect(sent.missingChunks).toEqual([2, 4])
    })

    it('falls back for legacy plaintext control messages', async () => {
        const legacy: Data = { dataType: DataType.FILE, message: 'FILE_ACCEPT', transferId: 't6' }
        expect(await decryptFileControl('peerX', legacy)).toBeNull()
    })

    it('falls back when an encrypted control message cannot be decrypted', async () => {
        await sendFileControlMessage('peerX', 't7', 'FILE_COMPLETE', { encryptionEnabled: true })
        const sent = lastSent()
        const tampered: Data = { ...sent, payload: 'AAAA' + (sent.payload ?? '').slice(4) }
        expect(await decryptFileControl('peerX', tampered)).toBeNull()
    })

    it('falls back when an encrypted control message lacks iv/payload', async () => {
        const broken: Data = { dataType: DataType.FILE, message: 'FILE_CANCEL', transferId: 't8', encrypted: true }
        expect(await decryptFileControl('peerX', broken)).toBeNull()
    })
})
