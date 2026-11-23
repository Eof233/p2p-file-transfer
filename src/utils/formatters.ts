export const formatFileSize = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    // Clamp the unit: sub-byte values (slow transfer speeds) stay in B and
    // anything beyond the largest unit is expressed in it.
    const i = Math.min(Math.max(Math.floor(Math.log(bytes) / Math.log(k)), 0), sizes.length - 1)
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export const formatSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s'
}

export const formatDuration = (seconds: number): string => {
    if (seconds === Infinity) return '∞'
    // Round up once, before splitting into units, so a fractional value can
    // never produce a 60s component ("60s", "1m 60s").
    const total = Math.ceil(seconds)
    if (total < 60) return `${total}s`
    if (total < 3600) return `${Math.floor(total / 60)}m ${total % 60}s`
    return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`
}

export const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString()
}

export const truncateId = (id: string, length: number = 8): string => {
    if (id.length <= length) return id
    return id.substring(0, length) + '...'
}
