/** Deterministic OpenRouter video-SKU selection and cost formulas. */

import type {
  OpenRouterVideoPricingRate,
  ProviderCostEstimate,
  ProviderCostRequest,
} from '../../server/pricing/contracts.js'

import {
  addProviderCostDecimals,
  divideProviderCostDecimals,
  multiplyProviderCostDecimals,
} from '../../server/pricing/decimal.js'
import {
  estimatedInputDurationSeconds,
  inputImageCount,
  requestedOutputDurationSeconds,
} from '../../server/pricing/request-facts.js'
import { seedanceVideoTokens } from '../../server/pricing/seedance.js'

const OPENROUTER_VIDEO_PRICING_SOURCE = 'https://openrouter.ai/api/v1/videos/models'

function unavailable(
  reason: Extract<ProviderCostEstimate, { status: 'unavailable' }>['reason'],
): ProviderCostEstimate {
  return { reason, status: 'unavailable' }
}

function selectedDurationSku(input: {
  request: ProviderCostRequest
  skus: Readonly<Record<string, string>>
}): [string, string] | undefined {
  const resolution = typeof input.request.settings.resolution === 'string'
    ? input.request.settings.resolution.toLowerCase()
    : undefined
  const withAudio = input.request.settings.generateAudio === true
  const operation = input.request.operationId === 'textToVideo'
    ? 'text_to_video'
    : input.request.operationId === 'imageToVideo'
      || input.request.operationId === 'firstLastFrameToVideo'
      || input.request.operationId === 'referencesToVideo'
      ? 'image_to_video'
      : undefined
  const candidates = [
    withAudio && resolution ? `duration_seconds_with_audio_${resolution}` : undefined,
    !withAudio && resolution ? `duration_seconds_without_audio_${resolution}` : undefined,
    withAudio ? 'duration_seconds_with_audio' : undefined,
    !withAudio ? 'duration_seconds_without_audio' : undefined,
    operation && resolution ? `${operation}_duration_seconds_${resolution}` : undefined,
    resolution ? `duration_seconds_${resolution}` : undefined,
    'duration_seconds',
  ].filter((candidate): candidate is string => Boolean(candidate))
  for (const candidate of candidates) {
    const rate = input.skus[candidate]
    if (rate !== undefined)
      return [candidate, rate]
  }
  return undefined
}

function estimateGrokVideo(input: {
  durationSeconds: number
  rate: OpenRouterVideoPricingRate
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const resolution = String(input.request.settings.resolution ?? '480p').toLowerCase()
  const outputSku = `cents_per_video_output_second_${resolution}`
  const outputCents = input.rate.pricingSkus[outputSku]
  if (!outputCents)
    return unavailable('unsupported_pricing_unit')
  const outputRateUsd = divideProviderCostDecimals(outputCents, 100)
  const outputSeconds = multiplyProviderCostDecimals(
    input.durationSeconds,
    input.request.outputCount,
  )
  const amounts = [multiplyProviderCostDecimals(outputSeconds, outputRateUsd)]
  const imageInputCents = input.rate.pricingSkus.cents_per_image_input
  const images = inputImageCount(input.request)
  if (images > 0 && imageInputCents) {
    amounts.push(multiplyProviderCostDecimals(
      images,
      divideProviderCostDecimals(imageInputCents, 100),
    ))
  }
  const amountUsd = addProviderCostDecimals(amounts)
  return {
    amountUsd,
    basis: {
      formulaVersion: 'openrouter-grok-video-skus-v1',
      pricingModelId: input.rate.nativeModelId,
      pricingRetrievedAt: input.rate.retrievedAt,
      pricingSource: OPENROUTER_VIDEO_PRICING_SOURCE,
      unit: `equivalent ${outputSku}`,
      unitPriceUsd: outputRateUsd,
    },
    currency: 'USD',
    quantity: divideProviderCostDecimals(amountUsd, outputRateUsd),
    status: 'estimated',
  }
}

/** Estimates one OpenRouter video request from its current normalized SKU table. */
export function estimateOpenRouterVideoCost(input: {
  /** Current SKU table for the exact OpenRouter creative model. */
  rate: OpenRouterVideoPricingRate | undefined
  /** Immutable normalized request facts. */
  request: ProviderCostRequest
}): ProviderCostEstimate {
  if (!input.rate)
    return unavailable('pricing_unavailable')
  const duration = requestedOutputDurationSeconds(input.request)
    ?? (input.request.modelId === 'minimax/hailuo-2.3' ? 6 : undefined)
  if (!duration)
    return unavailable('unsupported_request')
  if (input.request.modelId === 'x-ai/grok-imagine-video') {
    return estimateGrokVideo({
      durationSeconds: duration,
      rate: input.rate,
      request: input.request,
    })
  }
  if (input.request.modelId.startsWith('bytedance/seedance-2.0')) {
    const effectiveDuration = addProviderCostDecimals([
      String(duration),
      multiplyProviderCostDecimals(
        estimatedInputDurationSeconds(input.request, 'video'),
        '0.6',
      ),
    ])
    const sku = input.request.settings.generateAudio === false
      ? 'video_tokens_without_audio'
      : 'video_tokens'
    const unitPriceUsd = input.rate.pricingSkus[sku]
    const quantity = seedanceVideoTokens({
      aspectRatio: input.request.settings.aspectRatio,
      durationSeconds: effectiveDuration,
      resolution: input.request.settings.resolution,
    })
    if (!unitPriceUsd || !quantity)
      return unavailable('unsupported_request')
    const outputQuantity = multiplyProviderCostDecimals(quantity, input.request.outputCount)
    return {
      amountUsd: multiplyProviderCostDecimals(outputQuantity, unitPriceUsd),
      basis: {
        formulaVersion: 'openrouter-seedance-video-tokens-v1',
        pricingModelId: input.rate.nativeModelId,
        pricingRetrievedAt: input.rate.retrievedAt,
        pricingSource: OPENROUTER_VIDEO_PRICING_SOURCE,
        unit: sku,
        unitPriceUsd,
      },
      currency: 'USD',
      quantity: outputQuantity,
      status: 'estimated',
    }
  }
  const selectedSku = selectedDurationSku({
    request: input.request,
    skus: input.rate.pricingSkus,
  })
  if (!selectedSku)
    return unavailable('unsupported_pricing_unit')
  const [unit, unitPriceUsd] = selectedSku
  const quantity = multiplyProviderCostDecimals(duration, input.request.outputCount)
  return {
    amountUsd: multiplyProviderCostDecimals(quantity, unitPriceUsd),
    basis: {
      formulaVersion: 'openrouter-video-duration-skus-v1',
      pricingModelId: input.rate.nativeModelId,
      pricingRetrievedAt: input.rate.retrievedAt,
      pricingSource: OPENROUTER_VIDEO_PRICING_SOURCE,
      unit,
      unitPriceUsd,
    },
    currency: 'USD',
    quantity,
    status: 'estimated',
  }
}
