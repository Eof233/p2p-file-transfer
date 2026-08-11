import { useState, useEffect, useCallback } from 'react'
import { PeerConnection } from '../helpers/peer'

interface ConnectionStats {
    peerId: string
    localAddress?: string
    remoteAddress?: string
    localPort?: number
    remotePort?: number
    latency?: number  // ms
    bytesReceived?: number
    bytesSent?: number
    connectionState?: string
    iceState?: string
    quality?: 'excellent' | 'good' | 'poor' | 'unknown'
}

export const useConnectionStats = (peerId?: string) => {
    const [stats, setStats] = useState<ConnectionStats | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchStats = useCallback(async () => {
        if (!peerId) return

        setLoading(true)
        try {
            const connectionMap = PeerConnection.getConnectionMap()
            const conn = connectionMap.get(peerId)

            if (!conn || !conn.peerConnection) {
                setStats(null)
                return
            }

            const pc = conn.peerConnection as RTCPeerConnection
            const rtcStats = await pc.getStats()

            let latency: number | undefined
            let localAddr: string | undefined
            let remoteAddr: string | undefined
            let localPort: number | undefined
            let remotePort: number | undefined
            let bytesRecv = 0
            let bytesSent = 0

            rtcStats.forEach((report: any) => {
                // Get candidate pair info for latency and addresses
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    latency = report.currentRoundTripTime
                        ? Math.round(report.currentRoundTripTime * 1000)
                        : undefined
                }

                // Get local candidate info
                if (report.type === 'local-candidate' && report.candidateType === 'host') {
                    localAddr = report.ip || report.address
                    localPort = report.port
                }

                // Get remote candidate info
                if (report.type === 'remote-candidate') {
                    remoteAddr = report.ip || report.address
                    remotePort = report.port
                }

                // Get data channel stats
                if (report.type === 'data-channel') {
                    bytesRecv = report.bytesReceived || 0
                    bytesSent = report.bytesSent || 0
                }
            })

            // Determine quality based on latency
            let quality: ConnectionStats['quality'] = 'unknown'
            if (latency !== undefined) {
                if (latency < 50) quality = 'excellent'
                else if (latency < 150) quality = 'good'
                else quality = 'poor'
            }

            setStats({
                peerId,
                localAddress: localAddr,
                remoteAddress: remoteAddr,
                localPort,
                remotePort,
                latency,
                bytesReceived: bytesRecv,
                bytesSent: bytesSent,
                connectionState: pc.connectionState,
                iceState: pc.iceConnectionState,
                quality,
            })
        } catch (err) {
            console.error('Failed to get connection stats:', err)
            setStats(null)
        } finally {
            setLoading(false)
        }
    }, [peerId])

    useEffect(() => {
        if (!peerId) return

        fetchStats()
        const interval = setInterval(fetchStats, 3000) // Update every 3 seconds

        return () => clearInterval(interval)
    }, [peerId, fetchStats])

    return { stats, loading, refresh: fetchStats }
}
