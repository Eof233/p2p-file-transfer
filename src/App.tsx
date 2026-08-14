import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatView } from './components/chat/ChatView'
import { ConnectionRequestDialog } from './components/connection/ConnectionRequestDialog'
import { Toast, ToastProvider, ToastViewport } from './components/ui/Toast'
import { useAppSelector, useAppDispatch } from './store/hooks'
import { startPeer, stopPeerSession } from './store/peer/peerActions'
import * as connectionAction from './store/connection/connectionActions'
import * as connectionRequestAction from './store/connection/connectionRequestActions'
import { resetFileTransfers } from './store/file/fileActions'
import { PeerConnection } from './helpers/peer'
import { loadSettings } from './store/settings/settingsActions'
import { clearAllTransferState } from './store/file/transferCoordinator'
import { clearAllReceiptQueues } from './store/chat/receiptQueue'
import { subscribeToasts, ToastInput } from './services/toastService'
import { useI18n } from './hooks/useI18n'
import './styles/globals.css'
import './styles/animations.css'

interface ActiveToast extends ToastInput {
    id: number
}

const TOAST_DURATION = 3500

export const App: React.FC = () => {
    const dispatch = useAppDispatch()
    const { t } = useI18n()
    const peer = useAppSelector((state) => state.peer)
    const connection = useAppSelector((state) => state.connection)
    const connectionRequests = useAppSelector((state) => state.connectionRequest.requests)

    const [toasts, setToasts] = useState<ActiveToast[]>([])
    const toastIdRef = useRef(0)

    const pushToast = (input: ToastInput) => {
        const id = ++toastIdRef.current
        setToasts((prev) => [...prev, { ...input, id }])
        setTimeout(() => {
            setToasts((prev) => prev.filter((toastItem) => toastItem.id !== id))
        }, TOAST_DURATION)
    }

    // Toast bus subscription
    useEffect(() => {
        return subscribeToasts((input) => pushToast(input))
    }, [])

    // Surface session start errors
    useEffect(() => {
        if (peer.error) {
            pushToast({ title: t.sessionError, description: peer.error, variant: 'error' })
        }
    }, [peer.error, t.sessionError])

    const pendingRequest = useMemo(() => {
        return connectionRequests.find(r => r.status === 'pending') || null
    }, [connectionRequests])

    // Load settings and connection history on mount
    useEffect(() => {
        dispatch(loadSettings() as any)
        dispatch(connectionAction.loadConnectionHistoryState() as any)
    }, [dispatch])

    const handleStartSession = () => {
        dispatch(startPeer() as any)
    }

    const handleStopSession = async () => {
        try {
            await PeerConnection.closePeerSession()
        } catch {
            // Continue with state cleanup even if close fails
        }
        clearAllTransferState()
        clearAllReceiptQueues()
        dispatch(stopPeerSession())
        dispatch(connectionAction.resetConnection())
        dispatch(resetFileTransfers())
    }

    const handleConnectPeer = (id: string) => {
        dispatch(connectionAction.connectPeer(id) as any)
    }

    const handleSelectConnection = (id: string) => {
        dispatch(connectionAction.selectConnection(id) as any)
    }

    const handleCopyId = async () => {
        if (peer.id) {
            await navigator.clipboard.writeText(peer.id)
            pushToast({ title: t.copied, variant: 'success' })
        }
    }

    const handleAcceptConnection = (peerId: string) => {
        dispatch(connectionRequestAction.acceptConnection(peerId) as any)
        pushToast({ title: t.connectionAccepted, variant: 'success' })
    }

    const handleRejectConnection = (peerId: string) => {
        dispatch(connectionRequestAction.rejectConnection(peerId) as any)
        pushToast({ title: t.connectionRejected, variant: 'info' })
    }

    return (
        <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
            {/* Header */}
            <Header
                myId={peer.id}
                isStarted={peer.started}
                onStart={handleStartSession}
                onStop={handleStopSession}
                onCopyId={handleCopyId}
                loading={peer.loading}
            />

            {/* Main Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                {peer.started && (
                    <Sidebar
                        connections={connection.list}
                        history={connection.history}
                        selectedId={connection.selectedId}
                        onSelect={handleSelectConnection}
                        onConnect={handleConnectPeer}
                        connectLoading={connection.loading}
                        connectError={connection.error}
                        myId={peer.id}
                        onCopyId={handleCopyId}
                        className="w-[var(--sidebar-width)]"
                    />
                )}

                {/* Chat Area */}
                <main className="flex-1 flex flex-col">
                    {peer.started ? (
                        <ChatView
                            peerId={connection.selectedId || ''}
                            peerName={connection.selectedId}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center animate-fade-in">
                                <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center rounded-2xl bg-[var(--bg-secondary)]">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                        <line x1="9" y1="9" x2="15" y2="9" />
                                        <line x1="9" y1="13" x2="13" y2="13" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                                    {t.appTitle}
                                </h2>
                                <p className="text-[var(--text-secondary)] mb-6 max-w-md">
                                    {t.welcomeDesc}
                                </p>
                                <button
                                    onClick={handleStartSession}
                                    disabled={peer.loading}
                                    className="press-feedback px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                                >
                                    {peer.loading ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            {t.stopping}
                                        </span>
                                    ) : (
                                        t.startSession
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Connection Request Dialog */}
            <ConnectionRequestDialog
                request={pendingRequest}
                onAccept={handleAcceptConnection}
                onReject={handleRejectConnection}
            />

            {/* Toast bus */}
            <ToastProvider duration={TOAST_DURATION}>
                {toasts.map((toastItem) => (
                    <Toast
                        key={toastItem.id}
                        open={true}
                        onOpenChange={() =>
                            setToasts((prev) => prev.filter((item) => item.id !== toastItem.id))
                        }
                        title={toastItem.title}
                        description={toastItem.description}
                        variant={toastItem.variant}
                    />
                ))}
                <ToastViewport className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2" />
            </ToastProvider>
        </div>
    )
}

export default App
