import type { SupportedLocale } from '@talelabs/i18n'

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
    return null

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

  return null
}

export function getBrowserName(userAgent: string | null | undefined) {
  if (!userAgent)
    return null

  if (/edg\//i.test(userAgent))
    return 'Microsoft Edge'
  if (/chrome|crios/i.test(userAgent))
    return 'Chrome'
  if (/firefox|fxios/i.test(userAgent))
    return 'Firefox'
  if (/safari/i.test(userAgent))
    return 'Safari'

  return null
}

export function formatSessionDate(
  value: Date | string,
  locale: SupportedLocale,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
