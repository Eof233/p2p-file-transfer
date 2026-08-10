import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { useEncryption } from '../../hooks/useEncryption'

interface SecuritySettingsProps {
    peerId?: string
}

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ peerId }) => {
    const { fingerprint, hasSessionKey } = useEncryption()
    const [showFingerprint, setShowFingerprint] = useState(false)

    const isEncrypted = peerId ? hasSessionKey(peerId) : false

    return (
        <div className="flex flex-col gap-4 p-4">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Security</h3>

            {/* Encryption Status */}
            <div className="flex items-center gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                <div className={`w-3 h-3 rounded-full ${isEncrypted ? 'bg-[var(--success)]' : 'bg-[var(--text-tertiary)]'}`} />
                <div>
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
                        <span>Your Fingerprint</span>
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
        </div>
    )
}
