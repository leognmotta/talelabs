/**
 * Shared conversion of normalized generation settings and Asset metadata into
 * the billing dimensions used by provider-specific pricing formulas.
 */

import type { ProviderCostRequest } from './contracts.js'

const DEFAULT_INPUT_DURATION_SECONDS = 30
const DEFAULT_IMAGE_EDGE_PIXELS = 1024
const DEFAULT_IMAGE_TOKEN_COUNT = 1024
const TEXT_CHARACTERS_PER_TOKEN = 4

function positiveNumber(value: boolean | number | string | undefined): number | undefined {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
}

function normalizedResolution(value: boolean | number | string | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function outputDimensionsFromFalBinding(
  request: ProviderCostRequest,
): { height: number, width: number } | undefined {
  if (request.binding.provider !== 'fal' || request.binding.requestProfile.kind !== 'image')
    return undefined
  for (const mapping of request.binding.requestProfile.combinedParams) {
    const [firstSettingId, secondSettingId] = mapping.settingIds
    const first = String(request.settings[firstSettingId] ?? '')
    const second = String(request.settings[secondSettingId] ?? '')
    const mapped = mapping.valueMap[first]?.[second]
    if (
      typeof mapped === 'object'
      && mapped !== null
      && 'height' in mapped
      && 'width' in mapped
    ) {
      return { height: mapped.height, width: mapped.width }
    }
  }
  return undefined
}

function dimensionsFromResolution(
  resolution: string,
  aspectRatio: string,
): { height: number, width: number } {
  const edge = resolution.includes('4k')
    ? 4096
    : resolution.includes('2k')
      ? 2048
      : DEFAULT_IMAGE_EDGE_PIXELS
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(aspectRatio)
  if (!match)
    return { height: edge, width: edge }
  const widthRatio = Number(match[1])
  const heightRatio = Number(match[2])
  if (!(widthRatio > 0) || !(heightRatio > 0))
    return { height: edge, width: edge }
  return widthRatio >= heightRatio
    ? { height: Math.max(1, Math.round(edge * heightRatio / widthRatio)), width: edge }
    : { height: edge, width: Math.max(1, Math.round(edge * widthRatio / heightRatio)) }
}

/** Estimates tokenizer input units from Unicode-character count. */
export function estimatedTextTokenCount(characterCount: number): number {
  return Math.ceil(Math.max(0, characterCount) / TEXT_CHARACTERS_PER_TOKEN)
}

/** Selects the expected output-token budget represented by response length. */
export function estimatedCompletionTokenCount(
  request: ProviderCostRequest,
  endpointMaximum: number | null = null,
): number {
  const expected = {
    auto: 2048,
    long: 8192,
    medium: 2048,
    short: 512,
  }[String(request.settings.responseLength ?? 'auto')] ?? 2048
  return endpointMaximum && endpointMaximum > 0
    ? Math.min(expected, endpointMaximum)
    : expected
}

/** Estimates audio completion tokens for speech synthesis from script length. */
export function estimatedSpeechOutputTokenCount(characterCount: number): number {
  const estimatedSeconds = Math.max(1, characterCount / 15)
  return Math.ceil(estimatedSeconds * 32)
}

/** Resolves requested output duration in seconds for video and generated audio. */
export function requestedOutputDurationSeconds(
  request: ProviderCostRequest,
): number | undefined {
  return positiveNumber(request.settings.durationSeconds)
    ?? positiveNumber(request.settings.duration)
}

/** Sums input duration, using the documented estimate fallback for unknown media. */
export function estimatedInputDurationSeconds(
  request: ProviderCostRequest,
  mediaType: 'audio' | 'video',
): number {
  return request.inputAssets
    .filter(asset => asset.mediaType === mediaType)
    .reduce((total, asset) => {
      const duration = positiveNumber(asset.durationSeconds ?? undefined)
        ?? DEFAULT_INPUT_DURATION_SECONDS
      return total + duration
    }, 0)
}

/** Counts image inputs after admission has expanded static and same-run references. */
export function inputImageCount(request: ProviderCostRequest): number {
  return request.inputAssets.filter(asset => asset.mediaType === 'image').length
}

/** Estimates provider image tokens from input dimensions with a bounded default. */
export function estimatedInputImageTokenCount(request: ProviderCostRequest): number {
  return request.inputAssets
    .filter(asset => asset.mediaType === 'image')
    .reduce((total, asset) => {
      if (!asset.width || !asset.height)
        return total + DEFAULT_IMAGE_TOKEN_COUNT
      return total + Math.max(256, Math.ceil(asset.width * asset.height / 768))
    }, 0)
}

/** Resolves the output dimensions represented by normalized image settings. */
export function estimatedOutputImageDimensions(
  request: ProviderCostRequest,
): { height: number, width: number } {
  return outputDimensionsFromFalBinding(request) ?? dimensionsFromResolution(
    normalizedResolution(request.settings.resolution),
    String(request.settings.aspectRatio ?? '1:1'),
  )
}

/** Returns rounded-up output megapixels per generated image. */
export function billedOutputMegapixels(request: ProviderCostRequest): number {
  const dimensions = estimatedOutputImageDimensions(request)
  return Math.max(1, Math.ceil(dimensions.width * dimensions.height / 1_000_000))
}

/** Returns rounded-up processed megapixels across every input image. */
export function billedInputMegapixels(request: ProviderCostRequest): number {
  return request.inputAssets
    .filter(asset => asset.mediaType === 'image')
    .reduce((total, asset) => total + (
      asset.width && asset.height
        ? Math.max(1, Math.ceil(asset.width * asset.height / 1_000_000))
        : 1
    ), 0)
}

/** Maps reviewed image model settings to expected provider output-image tokens. */
export function estimatedOutputImageTokenCount(request: ProviderCostRequest): number {
  const resolution = normalizedResolution(request.settings.resolution)
  if (request.modelId === 'google/gemini-3.1-flash-lite-image')
    return 1120
  if (request.modelId === 'google/gemini-3.1-flash-image') {
    if (resolution === '4k')
      return 2520
    if (resolution === '2k')
      return 1680
    return 1120
  }
  if (request.modelId === 'google/gemini-3-pro-image')
    return resolution === '4k' ? 2000 : 1120
  if (
    request.modelId === 'openai/gpt-image-2'
    || request.modelId === 'openai/gpt-5.4-image-2'
  ) {
    const quality = String(request.settings.quality ?? 'auto').toLowerCase()
    return quality === 'high' ? 4160 : quality === 'low' ? 272 : 1056
  }
  if (request.modelId === 'microsoft/mai-image-2.5')
    return 1024
  return 1024
}

/** Normalizes a requested image-resolution variant for provider SKU matching. */
export function imageResolutionVariant(request: ProviderCostRequest): string {
  const resolution = normalizedResolution(request.settings.resolution)
  return resolution === '2k' ? '2k' : resolution === '4k' ? '4k' : '1k'
}
