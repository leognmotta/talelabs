/** Lazy, validated catalog loading for TaleLabs product surfaces. */

import type { SupportedLocale } from './locales.js'

/** i18next namespace owned by the authenticated dashboard. */
export const DASHBOARD_NAMESPACE = 'dashboard'

/** i18next namespace owned by the public website. */
export const WEB_NAMESPACE = 'web'

const dashboardCatalogLoaders: Record<SupportedLocale, () => Promise<unknown>> = {
  'de': () => import('./catalogs/de/dashboard.json'),
  'en': () => import('./catalogs/en/dashboard.json'),
  'es': () => import('./catalogs/es/dashboard.json'),
  'fr': () => import('./catalogs/fr/dashboard.json'),
  'it': () => import('./catalogs/it/dashboard.json'),
  'nl': () => import('./catalogs/nl/dashboard.json'),
  'pl': () => import('./catalogs/pl/dashboard.json'),
  'pt-BR': () => import('./catalogs/pt-BR/dashboard.json'),
  'pt-PT': () => import('./catalogs/pt-PT/dashboard.json'),
  'ro': () => import('./catalogs/ro/dashboard.json'),
}

const webCatalogLoaders: Record<SupportedLocale, () => Promise<unknown>> = {
  'de': () => import('./catalogs/de/web.json'),
  'en': () => import('./catalogs/en/web.json'),
  'es': () => import('./catalogs/es/web.json'),
  'fr': () => import('./catalogs/fr/web.json'),
  'it': () => import('./catalogs/it/web.json'),
  'nl': () => import('./catalogs/nl/web.json'),
  'pl': () => import('./catalogs/pl/web.json'),
  'pt-BR': () => import('./catalogs/pt-BR/web.json'),
  'pt-PT': () => import('./catalogs/pt-PT/web.json'),
  'ro': () => import('./catalogs/ro/web.json'),
}

/** English dashboard catalog shape used for typed translation resources. */
export type DashboardCatalog = typeof import('./catalogs/en/dashboard.json')

/** English public-site catalog shape used for typed translation resources. */
export type WebCatalog = typeof import('./catalogs/en/web.json')

interface CatalogModule {
  default: Record<string, unknown>
}

function mergeCatalog(
  fallback: Record<string, unknown>,
  localized: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fallback).map(([key, value]) => {
    const localizedValue = localized[key]

    if (
      value
      && localizedValue
      && typeof value === 'object'
      && typeof localizedValue === 'object'
      && !Array.isArray(value)
      && !Array.isArray(localizedValue)
    ) {
      return [key, mergeCatalog(
        value as Record<string, unknown>,
        localizedValue as Record<string, unknown>,
      )]
    }

    return [key, localizedValue ?? value]
  }))
}

async function loadCatalog<T>(
  locale: SupportedLocale,
  loaders: Record<SupportedLocale, () => Promise<unknown>>,
) {
  const fallback = await loaders.en() as CatalogModule

  if (locale === 'en')
    return fallback.default as T

  const localized = await loaders[locale]() as CatalogModule
  return mergeCatalog(fallback.default, localized.default) as T
}

/** Loads one dashboard catalog with English values as a defensive fallback. */
export async function loadDashboardCatalog(locale: SupportedLocale) {
  return await loadCatalog<DashboardCatalog>(locale, dashboardCatalogLoaders)
}

/** Loads one public website catalog with English values as a defensive fallback. */
export async function loadWebCatalog(locale: SupportedLocale) {
  return await loadCatalog<WebCatalog>(locale, webCatalogLoaders)
}
