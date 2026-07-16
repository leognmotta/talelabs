const MAX_PROVIDER_PUBLIC_MESSAGE_LENGTH = 500

function nestedProviderErrorMessage(value: string) {
  const jsonStart = value.indexOf('{')
  if (jsonStart < 0)
    return value.replace(/^HTTP\s+\d+\s*:\s*/i, '')
  try {
    const parsed = JSON.parse(value.slice(jsonStart))
    if (!parsed || typeof parsed !== 'object')
      return null
    const error = 'error' in parsed ? parsed.error : parsed
    if (!error || typeof error !== 'object' || !('message' in error))
      return null
    return typeof error.message === 'string' ? error.message : null
  }
  catch {
    return null
  }
}

/** Converts an untrusted provider rejection into bounded user-presentable text. */
export function sanitizeProviderPublicMessage(value: unknown) {
  if (typeof value !== 'string')
    return null
  const message = nestedProviderErrorMessage(value.trim())
  if (!message)
    return null
  const sanitized = message
    .replaceAll(/https?:\/\/[^\s,)]+/gi, '[redacted-url]')
    .replaceAll(
      /((?:api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*)[^\s,;]+/gi,
      '$1[redacted]',
    )
    .replaceAll(/\brequest\s*id\s*:\s*[\w-]+/gi, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROVIDER_PUBLIC_MESSAGE_LENGTH)
  return sanitized || null
}
