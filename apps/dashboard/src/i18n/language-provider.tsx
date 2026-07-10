import type { LanguagePreference, SupportedLocale } from '@talelabs/i18n'
import type { ReactNode } from 'react'

import type { LanguageContextValue } from './language-context'
import { useCallback, useMemo, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import {
  getResolvedLocale,
  getStoredLanguagePreference,
  i18n,
  resolveLanguagePreference,
  storeLanguagePreference,
} from './i18n'
import { LanguageContext } from './language-context'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [storedPreference, setStoredPreference] = useState<LanguagePreference>(
    getStoredLanguagePreference,
  )
  const [resolvedLocale, setResolvedLocale] = useState<SupportedLocale>(
    getResolvedLocale,
  )

  const applyPreference = useCallback(async (
    nextPreference: LanguagePreference,
  ) => {
    const nextLocale = resolveLanguagePreference(nextPreference)
    storeLanguagePreference(nextPreference)
    setStoredPreference(nextPreference)
    setResolvedLocale(nextLocale)
    await i18n.changeLanguage(nextLocale)
  }, [])

  const syncAccountLocale = useCallback(async (
    accountLocale: SupportedLocale | null,
  ) => {
    await applyPreference(accountLocale ?? 'auto')
  }, [applyPreference])

  const value = useMemo<LanguageContextValue>(() => ({
    locale: resolvedLocale,
    preference: storedPreference,
    setPreference: applyPreference,
    syncAccountLocale,
  }), [applyPreference, resolvedLocale, storedPreference, syncAccountLocale])

  return (
    <LanguageContext value={value}>
      <I18nextProvider i18n={i18n} defaultNS="dashboard">
        {children}
      </I18nextProvider>
    </LanguageContext>
  )
}
