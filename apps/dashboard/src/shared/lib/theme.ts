/** Shared dashboard theme preference persistence and document application. */

/** User-selectable dashboard theme behavior. */
export type ThemePreference = 'dark' | 'light' | 'system'

const THEME_STORAGE_KEY = 'talelabs-theme'

/** Scopes token-based surfaces to the shared dark palette. */
export const DARK_THEME_CLASS_NAME = 'dark'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

/** Reads the saved theme preference, falling back to system behavior. */
export function getInitialThemePreference(): ThemePreference {
  if (typeof window === 'undefined')
    return 'system'

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  return isThemePreference(storedTheme) ? storedTheme : 'system'
}

/** Applies one theme preference to the dashboard document root. */
export function applyThemePreference(theme: ThemePreference) {
  if (typeof window === 'undefined')
    return

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark)

  document.documentElement.classList.toggle('dark', shouldUseDark)
  document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light'
}

/** Persists and immediately applies one dashboard theme preference. */
export function storeThemePreference(theme: ThemePreference) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyThemePreference(theme)
}
