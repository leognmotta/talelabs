/** Deterministic OpenRouter chat and speech token-pricing formulas. */

import type {
  OpenRouterTokenPricingRate,
  ProviderCostEstimate,
  ProviderCostRequest,
} from '../../server/pricing/contracts.js'

import {
  addProviderCostDecimals,
  divideProviderCostDecimals,
  multiplyProviderCostDecimals,
} from '../../server/pricing/decimal.js'
import {
  estimatedCompletionTokenCount,
  estimatedInputImageTokenCount,
  estimatedSpeechOutputTokenCount,
  estimatedTextTokenCount,
} from '../../server/pricing/request-facts.js'

const OPENROUTER_ENDPOINT_PRICING_SOURCE
  = 'https://openrouter.ai/api/v1/models/{model}/endpoints'

/** Estimates one exact pinned OpenRouter chat or speech request. */
export function estimateOpenRouterTokenCost(input: {
  /** Current token pricing for the exact pinned OpenRouter endpoint. */
  rate: OpenRouterTokenPricingRate | undefined
  /** Immutable normalized request facts. */
  request: ProviderCostRequest
}): ProviderCostEstimate {
  if (!input.rate)
    return { reason: 'pricing_unavailable', status: 'unavailable' }
  if (
    input.request.binding.provider !== 'openrouter'
    || input.request.binding.protocol !== input.rate.protocol
  ) {
    return { reason: 'unsupported_request', status: 'unavailable' }
  }
  const completionRate = input.rate.tokenPricing.completion
  const promptRate = input.rate.tokenPricing.prompt
  if (!completionRate || !promptRate)
    return { reason: 'unsupported_pricing_unit', status: 'unavailable' }

  const promptTokens = estimatedTextTokenCount(input.request.textCharacterCount)
  const outputTokens = input.rate.protocol === 'speech'
    ? Math.min(
        estimatedSpeechOutputTokenCount(input.request.textCharacterCount),
        input.rate.maxCompletionTokens ?? Number.POSITIVE_INFINITY,
      )
    : estimatedCompletionTokenCount(input.request, input.rate.maxCompletionTokens)
  const imageTokens = estimatedInputImageTokenCount(input.request)
  const amounts = [
    multiplyProviderCostDecimals(promptTokens, promptRate),
    multiplyProviderCostDecimals(outputTokens, input.request.outputCount, completionRate),
  ]
  if (imageTokens > 0 && input.rate.tokenPricing.image) {
    amounts.push(multiplyProviderCostDecimals(
      imageTokens,
      input.rate.tokenPricing.image,
    ))
  }
  const amountUsd = addProviderCostDecimals(amounts)
  return {
    amountUsd,
    basis: {
      formulaVersion: input.rate.protocol === 'speech'
        ? 'openrouter-speech-token-estimate-v1'
        : 'openrouter-chat-token-estimate-v1',
      pricingModelId: input.rate.nativeModelId,
      pricingRetrievedAt: input.rate.retrievedAt,
      pricingSource: OPENROUTER_ENDPOINT_PRICING_SOURCE,
      unit: 'equivalent completion tokens',
      unitPriceUsd: completionRate,
    },
    currency: 'USD',
    quantity: divideProviderCostDecimals(amountUsd, completionRate),
    status: 'estimated',
  }
}
