import {SettingsActionType, SettingsState} from "./settingsTypes";
import {Dispatch} from "redux";
import {RootState} from "../index";
import {STORAGE_KEYS} from "../../utils/constants";

const SETTINGS_STORAGE_KEY = STORAGE_KEYS.SETTINGS

export const setTheme = (theme: SettingsState['theme']) => ({
    type: SettingsActionType.SETTINGS_THEME_SET, theme
})

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
            const settings = JSON.parse(stored) as Partial<SettingsState>
            dispatch(loadSettingsState(settings))
        }
    } catch (err) {
        console.log(err)
    }
})

export const saveSettings: () => (dispatch: Dispatch, getState: () => RootState) => void
    = () => ((_dispatch, getState) => {
    try {
        const {settings} = getState()
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch (err) {
        console.log(err)
    }
})
