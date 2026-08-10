import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { useEncryption } from '../../hooks/useEncryption'
import { useI18n } from '../../hooks/useI18n'
import { KeyVerificationDialog } from '../security/KeyVerificationDialog'

interface SecuritySettingsProps {
    peerId?: string
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ peerId }) => {
    const { t } = useI18n()
    const {
        fingerprint,
        hasSessionKey,
        peerFingerprints,
        getRemoteFingerprint,
        markPeerVerified,
        isPeerVerified,
    } = useEncryption()
    const [showFingerprint, setShowFingerprint] = useState(false)
    const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)

    const isEncrypted = peerId ? hasSessionKey(peerId) : false
    const remoteFingerprint = peerId ? getRemoteFingerprint(peerId) : ''
    const isVerified = peerId ? isPeerVerified(peerId) : false
    const canVerify = isEncrypted && !!remoteFingerprint

    return (
        <div className="flex flex-col gap-4 p-4">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Security</h3>

            {/* Encryption Status */}
            <div className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                <div className={`w-3 h-3 rounded-full ${isEncrypted ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]'}`} />
                <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                        {isEncrypted ? 'End-to-End Encrypted' : 'Not Encrypted'}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                        {isEncrypted
                            ? 'Messages are secured with AES-256-GCM'
                            : 'Encryption will be established on connection'
                        }
                    </div>
                </div>
                {/* Verification badge */}
                {isVerified && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                            Verified
                        </span>
                    </div>
                )}
            </div>

            {/* Fingerprint */}
            {fingerprint && (
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFingerprint(!showFingerprint)}
                        className="w-full justify-between"
                    >
                        <span>{t.yourFingerprint}</span>
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`transition-transform ${showFingerprint ? 'rotate-180' : ''}`}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </Button>

                    {showFingerprint && (
                        <div className="mt-2 p-3 bg-[var(--bg-secondary)] rounded-lg">
                            <code className="text-xs font-mono text-[var(--text-secondary)] break-all">
                                {fingerprint}
                            </code>
                            <p className="text-xs text-[var(--text-tertiary)] mt-2">
                                Verify this fingerprint matches your peer's displayed value.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Verify Keys Button */}
            {canVerify && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setVerifyDialogOpen(true)}
                    className="w-full"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="mr-2"
                    >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    {t.verifyKeys}
                </Button>
            )}

            {/* Key Verification Dialog */}
            {peerId && fingerprint && remoteFingerprint && (
                <KeyVerificationDialog
                    open={verifyDialogOpen}
                    onOpenChange={setVerifyDialogOpen}
                    peerId={peerId}
                    localFingerprint={fingerprint}
                    remoteFingerprint={remoteFingerprint}
                    onVerified={() => markPeerVerified(peerId)}
                />
            )}
        </div>
    )
}
