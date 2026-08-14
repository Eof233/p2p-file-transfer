export enum SettingsActionType {
    SETTINGS_THEME_SET = 'SETTINGS_THEME_SET',
    SETTINGS_ENCRYPTION_TOGGLE = 'SETTINGS_ENCRYPTION_TOGGLE',
    SETTINGS_ENCRYPT_LOCAL_DATA_TOGGLE = 'SETTINGS_ENCRYPT_LOCAL_DATA_TOGGLE',
    SETTINGS_MAX_FILE_SIZE_SET = 'SETTINGS_MAX_FILE_SIZE_SET',
    SETTINGS_NOTIFICATIONS_TOGGLE = 'SETTINGS_NOTIFICATIONS_TOGGLE',
    SETTINGS_LANGUAGE_SET = 'SETTINGS_LANGUAGE_SET',
    SETTINGS_LOAD = 'SETTINGS_LOAD',
}

export type Theme = 'light' | 'dark' | 'system'

export type Language = 'en' | 'zh'

export interface SettingsState {
    readonly theme: Theme
    readonly encryptionEnabled: boolean
    readonly maxFileSize: number  // in bytes, default 100MB
    readonly notificationsEnabled: boolean
    readonly language: Language
    readonly encryptLocalData: boolean
}
