import { SettingsActionType, SettingsState } from './settingsTypes'
import { Dispatch } from 'redux'
import { STORAGE_KEYS } from '../../utils/constants'
import { initialState } from './settingsReducer'

const SETTINGS_STORAGE_KEY = STORAGE_KEYS.SETTINGS

export const toggleEncryption = () => ({
    type: SettingsActionType.SETTINGS_ENCRYPTION_TOGGLE,
})

export const setMaxFileSize = (maxFileSize: number) => ({
    type: SettingsActionType.SETTINGS_MAX_FILE_SIZE_SET, maxFileSize
})

export const toggleNotifications = () => ({
    type: SettingsActionType.SETTINGS_NOTIFICATIONS_TOGGLE,
})

export const loadSettingsState = (settings: Partial<SettingsState>) => ({
    type: SettingsActionType.SETTINGS_LOAD, settings
})

export const loadSettings: () => (dispatch: Dispatch) => void
    = () => ((dispatch) => {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (stored) {
            // Merge over the defaults so settings saved by older versions
            // (which lack the encryptLocalData field) keep the default value.
            const settings = { ...initialState, ...JSON.parse(stored) } as Partial<SettingsState>
            dispatch(loadSettingsState(settings))
        }
    } catch (err) {
        console.log(err)
    }
})
