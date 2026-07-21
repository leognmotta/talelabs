/** Deterministic OpenRouter image pricing-line interpretation. */

import type {
  OpenRouterImagePricingRate,
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
  estimatedInputImageTokenCount,
  estimatedOutputImageTokenCount,
  estimatedTextTokenCount,
  imageResolutionVariant,
  inputImageCount,
} from '../../server/pricing/request-facts.js'

const OPENROUTER_IMAGE_PRICING_SOURCE
  = 'https://openrouter.ai/api/v1/images/models/{model}/endpoints'

type PricingLine = OpenRouterImagePricingRate['pricing'][number]

function outputPricingLine(
  request: ProviderCostRequest,
  pricing: readonly PricingLine[],
): PricingLine | undefined {
  const outputLines = pricing.filter(line => line.billable === 'output_image')
  const requestedVariant = imageResolutionVariant(request)
  return outputLines.find(line => line.variant?.toLowerCase() === requestedVariant)
    ?? (outputLines.length === 1 ? outputLines[0] : undefined)
}

function outputQuantity(
  request: ProviderCostRequest,
  line: PricingLine,
): string | undefined {
  switch (line.unit.toLowerCase()) {
    case 'image':
    case 'images':
      return String(request.outputCount)
    case 'megapixel':
    case 'megapixels':
      return multiplyProviderCostDecimals(
        billedOutputMegapixels(request),
        request.outputCount,
      )
    case 'token':
    case 'tokens':
      return multiplyProviderCostDecimals(
        estimatedOutputImageTokenCount(request),
        request.outputCount,
      )
    default:
      return undefined
  }
}

function inputQuantity(
  request: ProviderCostRequest,
  line: PricingLine,
): string | undefined {
  if (line.billable === 'input_text') {
    return line.unit.toLowerCase().startsWith('token')
      ? String(estimatedTextTokenCount(request.textCharacterCount))
      : undefined
  }
  if (line.billable !== 'input_image')
    return undefined
  switch (line.unit.toLowerCase()) {
    case 'image':
    case 'images':
      return String(inputImageCount(request))
    case 'megapixel':
    case 'megapixels':
      return String(billedInputMegapixels(request))
    case 'token':
    case 'tokens':
      return String(request.modelId === 'google/gemini-3-pro-image'
        ? inputImageCount(request) * 560
        : estimatedInputImageTokenCount(request))
    default:
      return undefined
  }
}

/** Estimates an OpenRouter image request from reviewed endpoint pricing lines. */
export function estimateOpenRouterImageCost(input: {
  /** Current pricing lines for the exact pinned OpenRouter endpoint. */
  rate: OpenRouterImagePricingRate | undefined
  /** Immutable normalized request facts. */
  request: ProviderCostRequest
}): ProviderCostEstimate {
  if (!input.rate)
    return { reason: 'pricing_unavailable', status: 'unavailable' }
  const outputRate = outputPricingLine(input.request, input.rate.pricing)
  if (!outputRate)
    return { reason: 'ambiguous_pricing', status: 'unavailable' }
  const requestedOutputQuantity = outputQuantity(input.request, outputRate)
  if (!requestedOutputQuantity)
    return { reason: 'unsupported_pricing_unit', status: 'unavailable' }

  const amounts = [multiplyProviderCostDecimals(
    requestedOutputQuantity,
    outputRate.costUsd,
  )]
  for (const line of input.rate.pricing) {
    if (line === outputRate || line.billable === 'output_image')
      continue
    const quantity = inputQuantity(input.request, line)
    if (quantity === undefined)
      return { reason: 'unsupported_pricing_unit', status: 'unavailable' }
    amounts.push(multiplyProviderCostDecimals(quantity, line.costUsd))
  }
  const amountUsd = addProviderCostDecimals(amounts)
  return {
    amountUsd,
    basis: {
      formulaVersion: 'openrouter-image-pricing-lines-v2',
      pricingModelId: input.rate.nativeModelId,
      pricingRetrievedAt: input.rate.retrievedAt,
      pricingSource: OPENROUTER_IMAGE_PRICING_SOURCE,
      unit: `equivalent output_image ${outputRate.unit}`,
      unitPriceUsd: outputRate.costUsd,
    },
    currency: 'USD',
    quantity: divideProviderCostDecimals(amountUsd, outputRate.costUsd),
    status: 'estimated',
  }
}
