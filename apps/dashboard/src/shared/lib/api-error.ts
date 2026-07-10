import { ApiError } from '@talelabs/sdk'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError) || !isRecord(error.data))
    return fallback

  const payload = error.data.error

  if (!isRecord(payload) || typeof payload.message !== 'string')
    return fallback

  return payload.message
}
