// Log levels in order of severity
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
}

// Log entry structure
export interface LogEntry {
    timestamp: number
    level: LogLevel
    module: string
    message: string
    data?: unknown
    error?: Error
}

// Log level colors for console output
const LOG_COLORS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '#8E8E93',  // gray
    [LogLevel.INFO]: '#007AFF',   // blue
    [LogLevel.WARN]: '#FF9500',   // orange
    [LogLevel.ERROR]: '#FF3B30',  // red
    [LogLevel.FATAL]: '#FF2D55',  // pink
}

const LOG_LABELS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.FATAL]: 'FATAL',
}

// Storage configuration
const STORAGE_KEY = 'p2p-messenger-logs'
const MAX_LOGS = 1000  // Maximum logs to keep in storage
const LOG_ROTATION_COUNT = 200  // Remove this many when rotating

class LogService {
    private logs: LogEntry[] = []
    private currentLevel: LogLevel = LogLevel.DEBUG
    private enableConsole: boolean = true
    private enableStorage: boolean = true
    private modules: Set<string> = new Set()
    private listeners: Set<() => void> = new Set()

    constructor() {
        this.loadLogs()
        this.setupErrorHandlers()
    }

    // Subscribe to log changes (new entry appended or logs cleared).
    // Returns an unsubscribe function.
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener())
    }

    // Set minimum log level
    setLevel(level: LogLevel): void {
        this.currentLevel = level
    }

    // Enable/disable console output
    setConsoleEnabled(enabled: boolean): void {
        this.enableConsole = enabled
    }

    // Enable/disable storage
    setStorageEnabled(enabled: boolean): void {
        this.enableStorage = enabled
    }

    // Register a module name
    registerModule(name: string): void {
        this.modules.add(name)
    }

    // Core log method
    private log(level: LogLevel, module: string, message: string, data?: unknown, error?: Error): void {
        if (level < this.currentLevel) return

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            module,
            message,
            data,
            error,
        }

        this.logs.push(entry)

        if (this.enableConsole) {
            this.outputToConsole(entry)
        }

        if (this.enableStorage) {
            this.persistLogs()
        }

        this.notifyListeners()
    }

    // Console output with formatting
    private outputToConsole(entry: LogEntry): void {
        const color = LOG_COLORS[entry.level]
        const label = LOG_LABELS[entry.level]
        const time = new Date(entry.timestamp).toLocaleTimeString()
        const prefix = `[${time}] [${label}] [${entry.module}]`

        const style = `color: ${color}; font-weight: bold;`

        if (entry.error) {
            console.log(`%c${prefix}%c ${entry.message}`, style, 'color: inherit;', entry.data || '', entry.error)
        } else if (entry.data) {
            console.log(`%c${prefix}%c ${entry.message}`, style, 'color: inherit;', entry.data)
        } else {
            console.log(`%c${prefix}%c ${entry.message}`, style, 'color: inherit;')
        }
    }

    // Persist logs to localStorage
    private persistLogs(): void {
        try {
            // Rotate logs if too many
            if (this.logs.length > MAX_LOGS) {
                this.logs = this.logs.slice(-LOG_ROTATION_COUNT)
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs))
        } catch {
            // Storage full or unavailable
        }
    }

    // Load logs from localStorage
    private loadLogs(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                this.logs = JSON.parse(stored)
            }
        } catch {
            this.logs = []
        }
    }

    // Setup global error handlers
    private setupErrorHandlers(): void {
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                this.error('global', `Unhandled error: ${event.message}`, {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                }, event.error)
            })

            window.addEventListener('unhandledrejection', (event) => {
                this.error('global', 'Unhandled promise rejection', {
                    reason: event.reason,
                })
            })
        }
    }

    // Public logging methods
    debug(module: string, message: string, data?: unknown): void {
        this.log(LogLevel.DEBUG, module, message, data)
    }

    info(module: string, message: string, data?: unknown): void {
        this.log(LogLevel.INFO, module, message, data)
    }

    warn(module: string, message: string, data?: unknown): void {
        this.log(LogLevel.WARN, module, message, data)
    }

    error(module: string, message: string, data?: unknown, error?: Error): void {
        this.log(LogLevel.ERROR, module, message, data, error)
    }

    fatal(module: string, message: string, data?: unknown, error?: Error): void {
        this.log(LogLevel.FATAL, module, message, data, error)
    }

    // Get all logs
    getLogs(): LogEntry[] {
        return [...this.logs]
    }

    // Get logs filtered by level
    getLogsByLevel(level: LogLevel): LogEntry[] {
        return this.logs.filter(log => log.level === level)
    }

    // Get logs filtered by module
    getLogsByModule(module: string): LogEntry[] {
        return this.logs.filter(log => log.module === module)
    }

    // Clear all logs
    clearLogs(): void {
        this.logs = []
        localStorage.removeItem(STORAGE_KEY)
        this.notifyListeners()
    }

    // Export logs as JSON string
    exportAsJSON(): string {
        return JSON.stringify(this.logs, null, 2)
    }

    // Export logs as CSV string
    exportAsCSV(): string {
        const headers = ['Timestamp', 'Level', 'Module', 'Message', 'Data']
        const rows = this.logs.map(log => [
            new Date(log.timestamp).toISOString(),
            LOG_LABELS[log.level],
            log.module,
            `"${log.message.replace(/"/g, '""')}"`,
            log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : '',
        ])
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    }

    // Performance timing helper
    time(module: string, label: string): () => void {
        const start = performance.now()
        return () => {
            const duration = performance.now() - start
            this.debug(module, `${label}: ${duration.toFixed(2)}ms`, { duration })
        }
    }
}

// Singleton instance
export const logger = new LogService()

// Convenience functions for common modules
export const createLogger = (module: string) => ({
    debug: (message: string, data?: unknown) => logger.debug(module, message, data),
    info: (message: string, data?: unknown) => logger.info(module, message, data),
    warn: (message: string, data?: unknown) => logger.warn(module, message, data),
    error: (message: string, data?: unknown, error?: Error) => logger.error(module, message, data, error),
    fatal: (message: string, data?: unknown, error?: Error) => logger.fatal(module, message, data, error),
    time: (label: string) => logger.time(module, label),
})
