import { ApiError } from '@talelabs/sdk'
import { i18n } from '../../i18n/i18n'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getApiErrorMessage(error: unknown, fallbackKey: string) {
  const fallback = i18n.t(fallbackKey as 'errors.internal_error')

  if (!(error instanceof ApiError) || !isRecord(error.data))
    return fallback

  const payload = error.data.error

  if (!isRecord(payload))
    return fallback

  const code = typeof payload.code === 'string' ? payload.code : null
  const message = typeof payload.message === 'string' ? payload.message : fallback

  if (!code)
    return fallback

  return i18n.t(`errors.${code}` as 'errors.internal_error', {
    defaultValue: message,
  })
}
