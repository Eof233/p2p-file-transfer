export const ImageService = {
    // Compress image for sending
    compressImage: async (file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<File> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            const url = URL.createObjectURL(file)

            img.onload = () => {
                URL.revokeObjectURL(url)

                let { width, height } = img
                if (width > maxWidth) {
                    height = (height * maxWidth) / width
                    width = maxWidth
                }

                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext('2d')
                if (!ctx) { reject(new Error('Failed to get canvas context')); return }

                ctx.drawImage(img, 0, 0, width, height)

                canvas.toBlob(
                    (blob) => {
                        if (!blob) { reject(new Error('Failed to compress image')); return }
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
                    },
                    'image/jpeg',
                    quality
                )
            }

            img.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new Error('Failed to load image'))
            }

            img.src = url
        })
    },

    // Convert file to base64 for inline display
    fileToBase64: (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    },

    // Check if file is an image
    isImage: (file: File | { fileType: string }): boolean => {
        const type = file instanceof File ? file.type : file.fileType
        return type.startsWith('image/')
    },

    // Get image dimensions
    getImageDimensions: (file: File): Promise<{ width: number; height: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image()
            const url = URL.createObjectURL(file)
            img.onload = () => {
                URL.revokeObjectURL(url)
                resolve({ width: img.width, height: img.height })
            }
            img.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new Error('Failed to load image'))
            }
            img.src = url
        })
    },
}
