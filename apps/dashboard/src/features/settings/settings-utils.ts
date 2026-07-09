export type LanguagePreference = 'auto' | 'en' | 'pt-BR'

export const languageStorageKey = 'talelabs_language'

export function getInitialLanguagePreference(): LanguagePreference {
  if (typeof window === 'undefined')
    return 'auto'

  const stored = window.localStorage.getItem(languageStorageKey)
  if (stored === 'en' || stored === 'pt-BR' || stored === 'auto')
    return stored

  return 'auto'
}

export function getInitials(name: string, email: string) {
  const source = name.trim() || email.trim()
  return source
    .split(/[ @._-]+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function getDeviceName(userAgent: string | null | undefined) {
  if (!userAgent)
    return 'Unknown device'

  if (/iphone/i.test(userAgent))
    return 'iPhone'
  if (/ipad/i.test(userAgent))
    return 'iPad'
  if (/android/i.test(userAgent))
    return 'Android'
  if (/macintosh|mac os/i.test(userAgent))
    return 'Macintosh'
  if (/windows/i.test(userAgent))
    return 'Windows'
  if (/linux/i.test(userAgent))
    return 'Linux'

  return 'Device'
}

export function getBrowserName(userAgent: string | null | undefined) {
  if (!userAgent)
    return 'Browser'

  if (/edg\//i.test(userAgent))
    return 'Microsoft Edge'
  if (/chrome|crios/i.test(userAgent))
    return 'Chrome'
  if (/firefox|fxios/i.test(userAgent))
    return 'Firefox'
  if (/safari/i.test(userAgent))
    return 'Safari'

  return 'Browser'
}

export function formatSessionDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
