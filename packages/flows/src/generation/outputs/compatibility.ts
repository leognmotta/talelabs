import type { GenerationProviderDelivery } from '../contracts/provider.js'
import type { GenerationOutputType } from '../registry/types.js'

export const MAX_GENERATION_OUTPUT_BYTES = Object.freeze({
  audio: 32 * 1024 * 1024,
  image: 32 * 1024 * 1024,
  text: 0,
  video: 512 * 1024 * 1024,
})

function baseMimeType(value: string) {
  return value.split(';', 1)[0]!.trim().toLowerCase()
}

export function isCompatibleGenerationOutputMimeType(
  mediaType: GenerationOutputType,
  mimeType: string,
) {
  const normalized = baseMimeType(mimeType)
  if (mediaType === 'text')
    return normalized === 'text/plain'
  return normalized.startsWith(`${mediaType}/`)
}

export function isCompatibleGenerationOutputDelivery(
  mediaType: GenerationOutputType,
  delivery: GenerationProviderDelivery,
) {
  return mediaType === 'text' ? delivery === 'text' : delivery !== 'text'
}
