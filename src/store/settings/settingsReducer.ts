import { Reducer } from "redux";
import { SettingsActionType, SettingsState, Language } from "./settingsTypes";
import { getStoredLanguage } from "../../utils/i18n";
import { MAX_FILE_SIZE_DEFAULT } from "../../utils/constants";

export const initialState: SettingsState = {
    theme: 'system',
    encryptionEnabled: true,
    maxFileSize: MAX_FILE_SIZE_DEFAULT,
    notificationsEnabled: true,
    language: getStoredLanguage(),
}

export const SettingsReducer: Reducer<SettingsState> = (state = initialState, action) => {
    switch (action.type) {
        case SettingsActionType.SETTINGS_THEME_SET:
            return { ...state, theme: action.theme }
        case SettingsActionType.SETTINGS_ENCRYPTION_TOGGLE:
            return { ...state, encryptionEnabled: !state.encryptionEnabled }
        case SettingsActionType.SETTINGS_MAX_FILE_SIZE_SET:
            return { ...state, maxFileSize: action.maxFileSize }
        case SettingsActionType.SETTINGS_NOTIFICATIONS_TOGGLE:
            return { ...state, notificationsEnabled: !state.notificationsEnabled }
        case SettingsActionType.SETTINGS_LANGUAGE_SET:
            return { ...state, language: action.language as Language }
        case SettingsActionType.SETTINGS_LOAD:
            return { ...state, ...action.settings }
        default:
            return state
    }
}
