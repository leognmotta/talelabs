/** Reviewed Seedance pixel-token geometry shared by fal and OpenRouter. */

import { divideProviderCostDecimals, multiplyProviderCostDecimals } from './decimal.js'

const seedanceDimensions = {
  '1:1': { '1080p': [1080, 1080], '480p': [480, 480], '4k': [2160, 2160], '720p': [720, 720] },
  '16:9': { '1080p': [1920, 1080], '480p': [854, 480], '4k': [3840, 2160], '720p': [1280, 720] },
  '21:9': { '1080p': [2520, 1080], '480p': [1120, 480], '4k': [5040, 2160], '720p': [1680, 720] },
  '3:4': { '1080p': [1080, 1440], '480p': [480, 640], '4k': [2160, 2880], '720p': [720, 960] },
  '4:3': { '1080p': [1440, 1080], '480p': [640, 480], '4k': [2880, 2160], '720p': [960, 720] },
  '9:16': { '1080p': [1080, 1920], '480p': [480, 854], '4k': [2160, 3840], '720p': [720, 1280] },
} as const

/** Normalizes the catalog's human-facing 4K spelling for formula lookup. */
export function normalizeSeedanceResolution(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  return value.toLowerCase() === '4k' ? '4k' : value.toLowerCase()
}

/** Computes exact Seedance video tokens from validated request settings. */
export function seedanceVideoTokens(input: {
  /** Output aspect ratio such as `16:9`. */
  aspectRatio: unknown
  /** Effective billable duration in seconds. */
  durationSeconds: number | string
  /** Output resolution such as `720p` or `4K`. */
  resolution: unknown
}): string | undefined {
  if (typeof input.aspectRatio !== 'string')
    return undefined
  const resolution = normalizeSeedanceResolution(input.resolution)
  const byResolution = seedanceDimensions[
    input.aspectRatio as keyof typeof seedanceDimensions
  ]
  const dimensions = resolution
    ? byResolution?.[resolution as keyof typeof byResolution]
    : undefined
  if (!dimensions)
    return undefined
  const [width, height] = dimensions
  return divideProviderCostDecimals(
    multiplyProviderCostDecimals(width, height, input.durationSeconds, 24),
    1024,
  )
}
