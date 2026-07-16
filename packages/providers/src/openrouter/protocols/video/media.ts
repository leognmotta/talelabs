/**
 * Bounded OpenRouter video stream validation.
 *
 */

import { throwProviderResponseInvalid } from '../../errors.js'
import { isMp4 } from '../media-signatures.js'

/** Maximum accepted provider video output size. */
export const OPENROUTER_MAX_VIDEO_BYTES = 512 * 1024 * 1024

/** Counts and validates the MP4 prefix while storage consumes the stream. */
export async function* validatedOpenRouterVideoStream(
  stream: ReadableStream<Uint8Array>,
  maximumBytes = OPENROUTER_MAX_VIDEO_BYTES,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  const prefix = new Uint8Array(12)
  const pending: Uint8Array[] = []
  let byteCount = 0
  let prefixBytes = 0
  let validated = false
  let completed = false
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        completed = true
        break
      }
      if (next.value.byteLength === 0)
        continue
      byteCount += next.value.byteLength
      if (byteCount > maximumBytes)
        throwProviderResponseInvalid()
      if (validated) {
        yield next.value
        continue
      }
      pending.push(next.value)
      const copiedBytes = Math.min(
        prefix.byteLength - prefixBytes,
        next.value.byteLength,
      )
      prefix.set(next.value.subarray(0, copiedBytes), prefixBytes)
      prefixBytes += copiedBytes
      if (prefixBytes < prefix.byteLength)
        continue
      if (!isMp4(prefix))
        throwProviderResponseInvalid()
      validated = true
      for (const chunk of pending)
        yield chunk
      pending.length = 0
    }
    if (!validated)
      throwProviderResponseInvalid()
  }
  finally {
    if (!completed)
      await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
