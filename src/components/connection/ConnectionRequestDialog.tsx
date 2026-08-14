import React from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { useI18n } from '../../hooks/useI18n'
import { ConnectionRequest } from '../../store/connection/connectionRequestTypes'

interface ConnectionRequestDialogProps {
    request: ConnectionRequest | null
    onAccept: (peerId: string) => void
    onReject: (peerId: string) => void
}

export const ConnectionRequestDialog: React.FC<ConnectionRequestDialogProps> = ({
    request,
    onAccept,
    onReject,
}) => {
    const { t } = useI18n()

    const isOpen = request !== null && request.status === 'pending'

    const handleAccept = () => {
        if (request) {
            onAccept(request.peerId)
        }
    }

    const handleReject = () => {
        if (request) {
            onReject(request.peerId)
        }
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={() => {}}
            title={t.connectionRequest}
            description={`${request?.peerId} ${t.connectionRequestDesc}`}
        >
            <div className="space-y-4">
                {/* Peer ID */}
                <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">{t.peerIdLabel}</p>
                    <p className="text-sm font-mono text-[var(--text-primary)] break-all">
                        {request?.peerId}
                    </p>
                </div>

                {/* Remote fingerprint (identity check before accepting) */}
                {request?.fingerprint && (
                    <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <p className="text-xs text-[var(--text-tertiary)] mb-1">{t.peerFingerprint}</p>
                        <p className="text-sm font-mono text-[var(--text-primary)] break-all">
                            {request.fingerprint}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={handleReject}
                    >
                        {t.reject}
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1"
                        onClick={handleAccept}
                    >
                        {t.accept}
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}
