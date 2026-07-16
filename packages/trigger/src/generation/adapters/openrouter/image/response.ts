import { Buffer } from 'node:buffer'

import { throwProviderResponseInvalid } from '../../errors.js'

const MAX_IMAGE_BYTES = 32 * 1024 * 1024

export function decodeOpenRouterImage(value: string) {
  if (
    value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4
    || value.length % 4 !== 0
    || !/^[a-z0-9+/]*={0,2}$/i.test(value)
  ) {
    throwProviderResponseInvalid()
  }
  const bytes = Buffer.from(value, 'base64')
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES)
    throwProviderResponseInvalid()
  return new Uint8Array(bytes)
}

export function openRouterImageMimeType(value: string | undefined) {
  const mimeType = value?.toLowerCase() ?? 'image/png'
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType))
    throwProviderResponseInvalid()
  return mimeType
}
