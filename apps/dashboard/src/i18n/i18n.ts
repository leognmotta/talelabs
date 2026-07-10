import type {
  LanguagePreference,
  SupportedLocale,
} from '@talelabs/i18n'

import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  isSupportedLocale,
  resolveLocale,
  supportedLocales,
} from '@talelabs/i18n'
import {
  DASHBOARD_NAMESPACE,
  loadDashboardCatalog,
} from '@talelabs/i18n/catalogs'
import { createInstance } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'

export const languageStorageKey = 'talelabs_language'

function getStoredLocale() {
  if (typeof window === 'undefined')
    return null

  const stored = window.localStorage.getItem(languageStorageKey)
  return isSupportedLocale(stored) ? stored : null
}

export function getStoredLanguagePreference(): LanguagePreference {
  return getStoredLocale() ?? 'auto'
}

export function getDeviceLocale(): SupportedLocale {
  if (typeof navigator === 'undefined')
    return DEFAULT_LOCALE

  const browserLocales = navigator.languages?.length
    ? navigator.languages
    : [navigator.language]

  return resolveLocale(browserLocales, DEFAULT_LOCALE)
}

export function resolveLanguagePreference(preference: LanguagePreference) {
  return preference === 'auto' ? getDeviceLocale() : preference
}

export function storeLanguagePreference(preference: LanguagePreference) {
  if (typeof window === 'undefined')
    return

  if (preference === 'auto') {
    window.localStorage.removeItem(languageStorageKey)
    return
  }

  window.localStorage.setItem(languageStorageKey, preference)
}

const languageDetector = new LanguageDetector()
languageDetector.addDetector({
  name: 'talelabs',
  lookup: () => resolveLanguagePreference(getStoredLanguagePreference()),
})

export const i18n = createInstance()

export async function initializeI18n() {
  if (i18n.isInitialized)
    return i18n

  await i18n
    .use(languageDetector)
    .use(resourcesToBackend(async (language: string, namespace: string) => {
      if (namespace !== DASHBOARD_NAMESPACE)
        return {}

      const locale = resolveLocale([language])
      return await loadDashboardCatalog(locale)
    }))
    .use(initReactI18next)
    .init({
      defaultNS: DASHBOARD_NAMESPACE,
      detection: {
        caches: [],
        order: ['talelabs'],
      },
      fallbackLng: DEFAULT_LOCALE,
      interpolation: {
        escapeValue: false,
      },
      load: 'currentOnly',
      ns: [DASHBOARD_NAMESPACE],
      react: {
        useSuspense: false,
      },
      supportedLngs: [...supportedLocales],
    })

  applyDocumentLocale(resolveLocale([i18n.resolvedLanguage ?? i18n.language]))
  i18n.on('languageChanged', (language) => {
    applyDocumentLocale(resolveLocale([language]))
  })

  return i18n
}

function applyDocumentLocale(locale: SupportedLocale) {
  if (typeof document === 'undefined')
    return

  document.documentElement.lang = locale
  document.documentElement.dir = getLocaleDirection(locale)
}

export function getResolvedLocale() {
  if (!i18n.isInitialized)
    return resolveLanguagePreference(getStoredLanguagePreference())

  return resolveLocale([i18n.resolvedLanguage ?? i18n.language])
}
