export const DEFAULT_LOCALE = 'en'

export const supportedLocales = [
  'en',
  'pt-BR',
  'pt-PT',
  'es',
  'fr',
  'de',
  'it',
  'nl',
  'pl',
  'ro',
] as const

export type SupportedLocale = typeof supportedLocales[number]
export type LanguagePreference = SupportedLocale | 'auto'

export interface LocaleDefinition {
  locale: SupportedLocale
  nativeName: string
}

export const localeDefinitions: readonly LocaleDefinition[] = [
  { locale: 'en', nativeName: 'English' },
  { locale: 'pt-BR', nativeName: 'Português (Brasil)' },
  { locale: 'pt-PT', nativeName: 'Português (Portugal)' },
  { locale: 'es', nativeName: 'Español' },
  { locale: 'fr', nativeName: 'Français' },
  { locale: 'de', nativeName: 'Deutsch' },
  { locale: 'it', nativeName: 'Italiano' },
  { locale: 'nl', nativeName: 'Nederlands' },
  { locale: 'pl', nativeName: 'Polski' },
  { locale: 'ro', nativeName: 'Română' },
]

const localeLookup = new Map(
  supportedLocales.map(locale => [locale.toLowerCase(), locale]),
)

const languageFallbacks: Readonly<Record<string, SupportedLocale>> = {
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  pt: 'pt-PT',
  ro: 'ro',
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string'
    && localeLookup.has(value.replaceAll('_', '-').toLowerCase())
}

export function normalizeLocale(value: string): SupportedLocale | null {
  const normalized = value.trim().replaceAll('_', '-')
  const exact = localeLookup.get(normalized.toLowerCase())

  if (exact)
    return exact

  const language = normalized.split('-')[0]?.toLowerCase()
  return language ? languageFallbacks[language] ?? null : null
}

export function resolveLocale(
  requestedLocales: readonly string[],
  fallback: SupportedLocale = DEFAULT_LOCALE,
) {
  for (const requestedLocale of requestedLocales) {
    const locale = normalizeLocale(requestedLocale)

    if (locale)
      return locale
  }

  return fallback
}

export function getLocaleDirection(_locale: SupportedLocale): 'ltr' | 'rtl' {
  return 'ltr'
}
