/** Deterministic fal formulas for reviewed provider billing dimensions. */

import type {
  FalProviderPricingRate,
  ProviderCostEstimate,
  ProviderCostRequest,
} from '../../server/pricing/contracts.js'

import {
  addProviderCostDecimals,
  divideProviderCostDecimals,
  multiplyProviderCostDecimals,
} from '../../server/pricing/decimal.js'
import {
  billedInputMegapixels,
  billedOutputMegapixels,
  estimatedInputDurationSeconds,
  estimatedInputImageTokenCount,
  estimatedOutputImageDimensions,
  estimatedTextTokenCount,
  inputImageCount,
  requestedOutputDurationSeconds,
} from '../../server/pricing/request-facts.js'
import {
  normalizeSeedanceResolution,
  seedanceVideoTokens,
} from '../../server/pricing/seedance.js'

const FAL_PRICING_SOURCE = 'https://api.fal.ai/v1/models/pricing'
const SEEDANCE_4K_UNIT_PRICE_USD = '0.008'
const SEEDANCE_FAST_4K_UNIT_PRICE_USD = '0.0064'

function unavailable(
  reason: Extract<ProviderCostEstimate, { status: 'unavailable' }>['reason'],
): ProviderCostEstimate {
  return { reason, status: 'unavailable' }
}

function estimateFromQuantity(input: {
  formulaVersion: string
  quantity: number | string
  rate: FalProviderPricingRate
  source?: string
  unit?: string
  unitPriceUsd?: string
}): ProviderCostEstimate {
  const unitPriceUsd = input.unitPriceUsd ?? input.rate.unitPriceUsd
  const quantity = String(input.quantity)
  return {
    amountUsd: multiplyProviderCostDecimals(quantity, unitPriceUsd),
    basis: {
      formulaVersion: input.formulaVersion,
      pricingModelId: input.rate.nativeModelId,
      pricingRetrievedAt: input.rate.retrievedAt,
      pricingSource: input.source ?? FAL_PRICING_SOURCE,
      unit: input.unit ?? input.rate.unit,
      unitPriceUsd,
    },
    currency: 'USD',
    quantity,
    status: 'estimated',
  }
}

function estimateFromAmount(input: {
  amountUsd: string
  formulaVersion: string
  rate: FalProviderPricingRate
  unit: string
}): ProviderCostEstimate {
  if (!(Number(input.rate.unitPriceUsd) > 0))
    return unavailable('unsupported_pricing_unit')
  return {
    amountUsd: input.amountUsd,
    basis: {
      formulaVersion: input.formulaVersion,
      pricingModelId: input.rate.nativeModelId,
      pricingRetrievedAt: input.rate.retrievedAt,
      pricingSource: FAL_PRICING_SOURCE,
      unit: input.unit,
      unitPriceUsd: input.rate.unitPriceUsd,
    },
    currency: 'USD',
    quantity: divideProviderCostDecimals(input.amountUsd, input.rate.unitPriceUsd),
    status: 'estimated',
  }
}

function estimateFalSeedance(input: {
  rate: FalProviderPricingRate
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const duration = requestedOutputDurationSeconds(input.request)
  if (!duration)
    return unavailable('unsupported_request')
  const effectiveDuration = addProviderCostDecimals([
    String(duration),
    multiplyProviderCostDecimals(
      estimatedInputDurationSeconds(input.request, 'video'),
      '0.6',
    ),
  ])
  const tokens = seedanceVideoTokens({
    aspectRatio: input.request.settings.aspectRatio,
    durationSeconds: effectiveDuration,
    resolution: input.request.settings.resolution,
  })
  if (!tokens)
    return unavailable('unsupported_request')
  const fast = input.rate.nativeModelId.includes('/fast/')
  const unitPriceUsd = normalizeSeedanceResolution(input.request.settings.resolution) === '4k'
    ? fast ? SEEDANCE_FAST_4K_UNIT_PRICE_USD : SEEDANCE_4K_UNIT_PRICE_USD
    : input.rate.unitPriceUsd
  return estimateFromQuantity({
    formulaVersion: fast
      ? 'fal-seedance-fast-video-tokens-v1'
      : 'fal-seedance-video-tokens-v1',
    quantity: multiplyProviderCostDecimals(tokens, input.request.outputCount, '0.001'),
    rate: input.rate,
    unit: '1000 video tokens',
    unitPriceUsd,
  })
}

function estimateFalTokenImage(input: {
  rate: FalProviderPricingRate
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const promptTokens = estimatedTextTokenCount(input.request.textCharacterCount)
  const imageTokens = estimatedInputImageTokenCount(input.request)
  const nanoBananaLite = input.rate.nativeModelId.startsWith('google/nano-banana-lite')
  const amounts = nanoBananaLite
    ? [
        multiplyProviderCostDecimals(promptTokens, '0.0000003125'),
        multiplyProviderCostDecimals(imageTokens, '0.0000003125'),
        multiplyProviderCostDecimals(input.request.outputCount, 1120, '0.0000375'),
      ]
    : [
        multiplyProviderCostDecimals(promptTokens, '0.000005'),
        multiplyProviderCostDecimals(imageTokens, '0.000008'),
        multiplyProviderCostDecimals(input.request.outputCount, 1024, '0.000047'),
      ]
  return estimateFromAmount({
    amountUsd: addProviderCostDecimals(amounts),
    formulaVersion: nanoBananaLite
      ? 'fal-nano-banana-lite-token-estimate-v1'
      : 'fal-mai-image-token-estimate-v1',
    rate: input.rate,
    unit: `equivalent ${input.rate.unit}`,
  })
}

function estimateFalSeedreamPro(input: {
  rate: FalProviderPricingRate
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const dimensions = estimatedOutputImageDimensions(input.request)
  const unitsPerOutput = dimensions.width * dimensions.height <= 1536 * 1536 ? 1 : 2
  const outputUnits = unitsPerOutput * input.request.outputCount
  const additionalInputCost = multiplyProviderCostDecimals(
    Math.max(0, inputImageCount(input.request) - 1),
    '0.0045',
  )
  const amountUsd = addProviderCostDecimals([
    multiplyProviderCostDecimals(outputUnits, input.rate.unitPriceUsd),
    additionalInputCost,
  ])
  return estimateFromAmount({
    amountUsd,
    formulaVersion: 'fal-seedream-v5-pro-output-tiers-v1',
    rate: input.rate,
    unit: 'equivalent resolution units',
  })
}

function falDurationUnitPrice(
  request: ProviderCostRequest,
  fallback: string,
): string {
  const resolution = String(request.settings.resolution ?? '').toLowerCase()
  const audio = request.settings.generateAudio !== false
  switch (request.modelId) {
    case 'google/veo-3.1':
      return resolution === '4k' ? audio ? '0.6' : '0.4' : audio ? '0.4' : '0.2'
    case 'google/veo-3.1-fast':
      return resolution === '4k' ? audio ? '0.35' : '0.3' : audio ? '0.15' : '0.1'
    case 'google/veo-3.1-lite':
      return resolution === '1080p' ? audio ? '0.08' : '0.05' : audio ? '0.05' : '0.03'
    case 'x-ai/grok-imagine-video':
      return resolution === '720p' ? '0.07' : '0.05'
    case 'kwaivgi/kling-v3.0-pro':
      return audio ? '0.168' : '0.112'
    case 'kwaivgi/kling-v3.0-std':
      return audio ? '0.126' : '0.084'
    case 'alibaba/wan-2.7':
      return resolution === '1080p' ? '0.15' : '0.1'
    case 'alibaba/wan-2.6':
      if (request.operationId === 'textToVideo')
        return resolution === '1080p' ? '0.12' : resolution === '720p' ? '0.08' : '0.04'
      return resolution === '1080p' ? '0.15' : '0.1'
    default:
      return fallback
  }
}

function estimateFalSeconds(input: {
  rate: FalProviderPricingRate
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const duration = requestedOutputDurationSeconds(input.request)
  if (!duration)
    return unavailable('unsupported_request')
  return estimateFromQuantity({
    formulaVersion: 'fal-duration-seconds-v2',
    quantity: multiplyProviderCostDecimals(duration, input.request.outputCount),
    rate: input.rate,
    source: `https://fal.ai/models/${input.rate.nativeModelId}`,
    unitPriceUsd: falDurationUnitPrice(input.request, input.rate.unitPriceUsd),
  })
}

function estimateFalMinutes(input: {
  rate: FalProviderPricingRate
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const outputDuration = requestedOutputDurationSeconds(input.request)
  const audioInputDuration = estimatedInputDurationSeconds(input.request, 'audio')
  const videoInputDuration = estimatedInputDurationSeconds(input.request, 'video')
  const seconds = outputDuration
    ?? audioInputDuration + videoInputDuration
  if (!(seconds > 0))
    return unavailable('input_metadata_unavailable')
  return estimateFromQuantity({
    formulaVersion: outputDuration
      ? 'fal-generated-audio-minutes-v1'
      : videoInputDuration > 0
        ? 'fal-input-media-minutes-v2'
        : 'fal-input-audio-minutes-v1',
    quantity: multiplyProviderCostDecimals(
      divideProviderCostDecimals(seconds, 60),
      input.request.outputCount,
    ),
    rate: input.rate,
  })
}

function estimateFalProcessedMegapixels(input: {
  rate: FalProviderPricingRate
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const outputMegapixels = billedOutputMegapixels(input.request) * input.request.outputCount
  const inputMegapixels = billedInputMegapixels(input.request)
  const max = input.request.modelId === 'black-forest-labs/flux.2-max'
  const additionalRate = max ? '0.03' : '0.015'
  const amountUsd = addProviderCostDecimals([
    multiplyProviderCostDecimals(input.request.outputCount, input.rate.unitPriceUsd),
    multiplyProviderCostDecimals(
      Math.max(0, outputMegapixels - input.request.outputCount) + inputMegapixels,
      additionalRate,
    ),
  ])
  return estimateFromAmount({
    amountUsd,
    formulaVersion: max
      ? 'fal-flux-2-max-megapixel-tiers-v1'
      : 'fal-flux-2-pro-megapixel-tiers-v1',
    rate: input.rate,
    unit: 'equivalent processed megapixels',
  })
}

/** Estimates one fal request across every billing unit in the current catalog. */
export function estimateFalProviderCost(input: {
  /** Current unit rate for the exact fal endpoint. */
  rate: FalProviderPricingRate | undefined
  /** Immutable normalized request facts. */
  request: ProviderCostRequest
}): ProviderCostEstimate {
  if (!input.rate || input.rate.currency.toUpperCase() !== 'USD')
    return unavailable('pricing_unavailable')
  if (input.request.binding.provider !== 'fal')
    return unavailable('unsupported_request')
  if (input.request.modelId.startsWith('bytedance/seedance-2.0'))
    return estimateFalSeedance({ rate: input.rate, request: input.request })

  const unit = input.rate.unit.toLowerCase()
  if (unit === 'image' || unit === 'images') {
    return estimateFromQuantity({
      formulaVersion: 'fal-flat-output-image-v1',
      quantity: input.request.outputCount,
      rate: input.rate,
    })
  }
  if (unit === 'seconds')
    return estimateFalSeconds({ rate: input.rate, request: input.request })
  if (unit === 'minutes')
    return estimateFalMinutes({ rate: input.rate, request: input.request })
  if (unit === '1000 characters') {
    return estimateFromQuantity({
      formulaVersion: 'fal-text-thousand-characters-v1',
      quantity: multiplyProviderCostDecimals(
        input.request.textCharacterCount,
        input.request.outputCount,
        '0.001',
      ),
      rate: input.rate,
    })
  }
  if (unit === 'megapixels' || unit === 'processed megapixels')
    return estimateFalProcessedMegapixels({ rate: input.rate, request: input.request })
  if (input.rate.nativeModelId.startsWith('google/nano-banana-lite'))
    return estimateFalTokenImage({ rate: input.rate, request: input.request })
  if (input.rate.nativeModelId.startsWith('microsoft/mai-image-2.5'))
    return estimateFalTokenImage({ rate: input.rate, request: input.request })
  if (input.rate.nativeModelId.startsWith('bytedance/seedream/v5/pro'))
    return estimateFalSeedreamPro({ rate: input.rate, request: input.request })
  if (input.rate.nativeModelId.startsWith('fal-ai/minimax/hailuo-2.3/pro')) {
    return estimateFromQuantity({
      formulaVersion: 'fal-flat-generation-unit-v1',
      quantity: input.request.outputCount,
      rate: input.rate,
    })
  }
  return unavailable('unsupported_pricing_unit')
}
