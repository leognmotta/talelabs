export type ThemePreference = 'dark' | 'light' | 'system'

const THEME_STORAGE_KEY = 'connecto-theme'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system'
}

export function getInitialThemePreference(): ThemePreference {
  if (typeof window === 'undefined')
    return 'system'

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

  return isThemePreference(storedTheme) ? storedTheme : 'system'
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof window === 'undefined')
    return

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark)

  document.documentElement.classList.toggle('dark', shouldUseDark)
  document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light'
}

export function storeThemePreference(theme: ThemePreference) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyThemePreference(theme)
}
