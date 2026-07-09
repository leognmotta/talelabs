export interface CookiePreferences {
  analytics: boolean
  essential: true
  marketing: boolean
}

interface StoredCookiePreferences extends CookiePreferences {
  updatedAt: string
  version: 1
}

export const cookiePreferencesStorageKey = 'talelabs_cookie_preferences_v1'

export const defaultCookiePreferences: CookiePreferences = {
  analytics: true,
  essential: true,
  marketing: true,
}

function isStoredCookiePreferences(
  value: unknown,
): value is StoredCookiePreferences {
  if (!value || typeof value !== 'object')
    return false

  const preferences = value as Partial<StoredCookiePreferences>

  return preferences.version === 1
    && preferences.essential === true
    && typeof preferences.analytics === 'boolean'
    && typeof preferences.marketing === 'boolean'
}

export function getStoredCookiePreferences() {
  if (typeof window === 'undefined')
    return null

  const storedPreferences = window.localStorage.getItem(
    cookiePreferencesStorageKey,
  )

  if (!storedPreferences)
    return null

  try {
    const parsedPreferences = JSON.parse(storedPreferences) as unknown
    return isStoredCookiePreferences(parsedPreferences)
      ? parsedPreferences
      : null
  }
  catch {
    return null
  }
}

export function getInitialCookiePreferences(): CookiePreferences {
  const storedPreferences = getStoredCookiePreferences()

  if (!storedPreferences)
    return defaultCookiePreferences

  return {
    analytics: storedPreferences.analytics,
    essential: true,
    marketing: storedPreferences.marketing,
  }
}

export function hasStoredCookiePreferences() {
  return getStoredCookiePreferences() !== null
}

export function storeCookiePreferences(preferences: CookiePreferences) {
  const storedPreferences: StoredCookiePreferences = {
    analytics: preferences.analytics,
    essential: true,
    marketing: preferences.marketing,
    updatedAt: new Date().toISOString(),
    version: 1,
  }

  window.localStorage.setItem(
    cookiePreferencesStorageKey,
    JSON.stringify(storedPreferences),
  )

  return storedPreferences
}
