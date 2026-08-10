import React, { useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { useI18n } from '../../hooks/useI18n'

interface KeyVerificationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    peerId: string
    localFingerprint: string
    remoteFingerprint: string
    onVerified?: () => void
}

export const KeyVerificationDialog: React.FC<KeyVerificationDialogProps> = ({
    open, onOpenChange, peerId, localFingerprint, remoteFingerprint, onVerified
}) => {
    const { t } = useI18n()
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'mismatched'>('pending')

    const formatFingerprint = (fp: string) => {
        // Split into groups of 4 characters for readability
        return fp.match(/.{1,4}/g)?.join(' ') || fp
    }

    const handleVerify = () => {
        if (localFingerprint === remoteFingerprint) {
            setVerificationStatus('verified')
            onVerified?.()
        } else {
            setVerificationStatus('mismatched')
        }
    }

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            setVerificationStatus('pending')
        }
        onOpenChange(isOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange} title={t.verifyKeys}>
            <div className="flex flex-col gap-4 py-4">
                <p className="text-sm text-[var(--text-secondary)]">
                    {t.verifyKeysDesc}
                </p>

                {/* Local Fingerprint */}
                <div>
                    <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-2">{t.yourFingerprint}</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <code className="text-xs font-mono text-[var(--text-primary)] break-all">
                            {formatFingerprint(localFingerprint)}
                        </code>
                    </div>
                </div>

                {/* Remote Fingerprint */}
                <div>
                    <h4 className="text-xs font-medium text-[var(--text-tertiary)] mb-2">{t.peerFingerprint}</h4>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                        <code className="text-xs font-mono text-[var(--text-primary)] break-all">
                            {formatFingerprint(remoteFingerprint)}
                        </code>
                    </div>
                </div>

                {/* Verification Status */}
                {verificationStatus !== 'pending' && (
                    <div
                        className="flex items-center gap-2 p-3 rounded-lg"
                        style={{
                            backgroundColor: verificationStatus === 'verified'
                                ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                                : 'color-mix(in srgb, var(--error) 10%, transparent)',
                            color: verificationStatus === 'verified'
                                ? 'var(--success)'
                                : 'var(--error)',
                        }}
                    >
                        {verificationStatus === 'verified' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        )}
                        <span className="text-sm font-medium">
                            {verificationStatus === 'verified' ? t.keysVerified : t.keysMismatch}
                        </span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-2">
                    <Button variant="secondary" className="flex-1" onClick={() => handleOpenChange(false)}>
                        {t.close}
                    </Button>
                    {verificationStatus === 'pending' && (
                        <Button variant="primary" className="flex-1" onClick={handleVerify}>
                            {t.verifyKeys}
                        </Button>
                    )}
                </div>
            </div>
        </Dialog>
    )
}
