import type { LanguagePreference, SupportedLocale } from '@talelabs/i18n'

import { createContext, use } from 'react'

export interface LanguageContextValue {
  locale: SupportedLocale
  preference: LanguagePreference
  setPreference: (preference: LanguagePreference) => Promise<void>
  syncAccountLocale: (locale: SupportedLocale | null) => Promise<void>
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)

export function useLanguage() {
  const context = use(LanguageContext)

  if (!context)
    throw new Error('useLanguage must be used inside LanguageProvider')

  return context
}
