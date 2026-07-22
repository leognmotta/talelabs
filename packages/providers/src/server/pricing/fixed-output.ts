/**
 * Catalog-reviewed fixed-output provider pricing for omitted metadata units.
 */

import type {
  ProviderCostEstimate,
  ProviderCostRequest,
} from './contracts.js'

import { multiplyProviderCostDecimals } from './decimal.js'

/** Estimates one request from its reviewed per-output provider price. */
export function estimateFixedOutputProviderCost(
  request: ProviderCostRequest,
): ProviderCostEstimate | undefined {
  const pricing = request.binding.costCapture.preflightPricing
  if (!pricing)
    return undefined
  const quantity = String(request.outputCount)
  return {
    amountUsd: multiplyProviderCostDecimals(
      quantity,
      pricing.unitPriceUsd,
    ),
    basis: {
      formulaVersion: 'catalog-fixed-output-unit-v1',
      pricingModelId: request.binding.nativeModelId,
      pricingRetrievedAt: pricing.reviewedAt,
      pricingSource: pricing.source,
      unit: pricing.unit,
      unitPriceUsd: pricing.unitPriceUsd,
    },
    currency: 'USD',
    quantity,
    status: 'estimated',
  }
}
