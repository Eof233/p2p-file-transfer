import { useCallback } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { translations, Language, storeLanguage } from '../utils/i18n'
import { SettingsActionType } from '../store/settings/settingsTypes'

export const useI18n = () => {
    const dispatch = useAppDispatch()
    const language = useAppSelector((state) => state.settings.language)
    const t = translations[language]

    const setLanguage = useCallback((lang: Language) => {
        dispatch({ type: SettingsActionType.SETTINGS_LANGUAGE_SET, language: lang })
        storeLanguage(lang)
    }, [dispatch])

    const toggleLanguage = useCallback(() => {
        const newLang: Language = language === 'en' ? 'zh' : 'en'
        setLanguage(newLang)
    }, [language, setLanguage])

    return {
        t,
        language,
        setLanguage,
        toggleLanguage,
    }
}
