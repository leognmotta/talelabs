import { ApiError } from '@talelabs/sdk'
import { i18n } from '../../i18n/i18n'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getApiErrorCode(error: unknown) {
  if (!(error instanceof ApiError) || !isRecord(error.data))
    return null

  const payload = error.data.error
  if (!isRecord(payload))
    return null

  if (Array.isArray(payload.details)) {
    const detail = payload.details.find(isRecord)
    if (detail && typeof detail.code === 'string')
      return detail.code
  }

  return typeof payload.code === 'string' ? payload.code : null
}

export function getApiErrorMessage(error: unknown, fallbackKey: string) {
  const fallback = i18n.t(fallbackKey as 'errors.internal_error')

  if (!(error instanceof ApiError) || !isRecord(error.data))
    return fallback

  const payload = error.data.error

  if (!isRecord(payload))
    return fallback

  const code = getApiErrorCode(error)
  const message = typeof payload.message === 'string' ? payload.message : fallback

  if (!code)
    return fallback

  return i18n.t(`errors.${code}` as 'errors.internal_error', {
    defaultValue: message,
  })
}
