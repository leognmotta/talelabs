import type { SupportedLocale } from './locales.js'

export const DASHBOARD_NAMESPACE = 'dashboard'

const catalogLoaders: Record<SupportedLocale, () => Promise<unknown>> = {
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

export type DashboardCatalog = typeof import('./catalogs/en/dashboard.json')

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

export async function loadDashboardCatalog(locale: SupportedLocale) {
  const fallback = await catalogLoaders.en() as CatalogModule

  if (locale === 'en')
    return fallback.default as DashboardCatalog

  const localized = await catalogLoaders[locale]() as CatalogModule
  return mergeCatalog(fallback.default, localized.default) as DashboardCatalog
}
