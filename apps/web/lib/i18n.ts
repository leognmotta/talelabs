/** Request-scoped locale resolution and translation setup for Server Components. */

import type { SupportedLocale } from '@talelabs/i18n'

import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  resolveLocale,
} from '@talelabs/i18n'
import {
  loadWebCatalog,
  WEB_NAMESPACE,
} from '@talelabs/i18n/catalogs'
import { createInstance } from 'i18next'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'

const LANGUAGE_COOKIE = 'talelabs_language'

function parseAcceptedLocales(value: string | null) {
  if (!value)
    return []

  return value
    .split(',')
    .map(entry => entry.split(';')[0]?.trim())
    .filter((locale): locale is string => Boolean(locale))
}

/** Resolves a saved preference before falling back to the browser request order. */
export const getRequestLocale = cache(async (): Promise<SupportedLocale> => {
  const cookieStore = await cookies()
  const storedLocale = cookieStore.get(LANGUAGE_COOKIE)?.value

  if (isSupportedLocale(storedLocale))
    return resolveLocale([storedLocale], DEFAULT_LOCALE)

  const requestHeaders = await headers()
  return resolveLocale(
    parseAcceptedLocales(requestHeaders.get('accept-language')),
    DEFAULT_LOCALE,
  )
})

/** Creates one request-bound i18next translator for the public website catalog. */
export const getWebI18n = cache(async () => {
  const locale = await getRequestLocale()
  const catalog = await loadWebCatalog(locale)
  const instance = createInstance()

  await instance.init({
    defaultNS: WEB_NAMESPACE,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    lng: locale,
    resources: {
      [locale]: {
        [WEB_NAMESPACE]: catalog,
      },
    },
  })

  return {
    locale,
    t: instance.getFixedT(locale, WEB_NAMESPACE),
  }
})
