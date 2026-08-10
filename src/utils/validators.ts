export const validatePeerId = (id: string): boolean => {
    return id.trim().length > 0
}

export const validateMessage = (message: string, maxLength: number = 10000): { valid: boolean; error?: string } => {
    if (message.trim().length === 0) return { valid: false, error: 'Message cannot be empty' }
    if (message.length > maxLength) return { valid: false, error: `Message exceeds ${maxLength} characters` }
    return { valid: true }
}

export const validateFile = (
    file: File,
    maxSize: number,
    allowedTypes?: string[]
): { valid: boolean; error?: string } => {
    if (file.size > maxSize) {
        return { valid: false, error: `File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB` }
    }
    if (allowedTypes && allowedTypes.length > 0) {
        const isAllowed = allowedTypes.some(type => {
            if (type.endsWith('/*')) return file.type.startsWith(type.replace('/*', '/'))
            return file.type === type
        })
        if (!isAllowed) return { valid: false, error: 'File type not allowed' }
    }
    return { valid: true }
}

export const isValidUrl = (string: string): boolean => {
    try {
        new URL(string)
        return true
    } catch {
        return false
    }
}
