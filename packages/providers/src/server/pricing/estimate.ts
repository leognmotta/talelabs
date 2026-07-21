/** Provider-dispatched cost calculation and deterministic estimate aggregation. */

import type {
  DeterministicProviderCostEstimate,
  ProviderCostEstimate,
  ProviderCostRequest,
  ProviderPricingSnapshot,
} from './contracts.js'

import { estimateFalProviderCost } from '../../fal/server/pricing-estimator.js'
import { estimateOpenRouterImageCost } from '../../openrouter/server/image-pricing-estimator.js'
import { estimateOpenRouterTokenCost } from '../../openrouter/server/token-pricing-estimator.js'
import { estimateOpenRouterVideoCost } from '../../openrouter/server/video-pricing-estimator.js'
import { addProviderCostDecimals } from './decimal.js'

/** Estimates one candidate provider request from a request-scoped rate snapshot. */
export function estimateProviderCost(input: {
  /** Request-scoped current provider pricing metadata. */
  pricing: ProviderPricingSnapshot
  /** Exact candidate binding and normalized generation facts. */
  request: ProviderCostRequest
}): ProviderCostEstimate {
  const binding = input.request.binding
  if (binding.provider === 'fal') {
    const rate = input.pricing.rates.find(candidate =>
      candidate.provider === 'fal'
      && candidate.nativeModelId === binding.nativeModelId,
    )
    return estimateFalProviderCost({
      rate: rate?.provider === 'fal' ? rate : undefined,
      request: input.request,
    })
  }
  if (binding.protocol === 'video') {
    const rate = input.pricing.rates.find(candidate =>
      candidate.provider === 'openrouter'
      && 'pricingSkus' in candidate
      && candidate.nativeModelId === binding.nativeModelId,
    )
    return estimateOpenRouterVideoCost({
      rate: rate?.provider === 'openrouter' && 'pricingSkus' in rate ? rate : undefined,
      request: input.request,
    })
  }
  if (binding.protocol === 'image') {
    const rate = input.pricing.rates.find(candidate =>
      candidate.provider === 'openrouter'
      && 'pricing' in candidate
      && candidate.nativeModelId === binding.nativeModelId
      && candidate.providerTag === binding.providerTag,
    )
    return estimateOpenRouterImageCost({
      rate: rate?.provider === 'openrouter' && 'pricing' in rate ? rate : undefined,
      request: input.request,
    })
  }
  if (binding.protocol === 'chat' || binding.protocol === 'speech') {
    const rate = input.pricing.rates.find(candidate =>
      candidate.provider === 'openrouter'
      && 'tokenPricing' in candidate
      && candidate.nativeModelId === binding.nativeModelId
      && candidate.providerTag === binding.providerTag
      && candidate.protocol === binding.protocol,
    )
    return estimateOpenRouterTokenCost({
      rate: rate?.provider === 'openrouter' && 'tokenPricing' in rate ? rate : undefined,
      request: input.request,
    })
  }
  return { reason: 'unsupported_request', status: 'unavailable' }
}

/**
 * Aggregates per-job deterministic estimates only when their immutable pricing
 * basis is identical; otherwise the aggregate remains explicitly unavailable.
 */
export function aggregateProviderCostEstimates(
  estimates: readonly ProviderCostEstimate[],
): ProviderCostEstimate {
  if (estimates.length === 0)
    return { reason: 'unsupported_request', status: 'unavailable' }
  const deterministic = estimates.filter(
    (estimate): estimate is DeterministicProviderCostEstimate => estimate.status === 'estimated',
  )
  if (deterministic.length !== estimates.length) {
    const unavailable = estimates.find(estimate => estimate.status === 'unavailable')
    return unavailable ?? { reason: 'pricing_unavailable', status: 'unavailable' }
  }
  const [first, ...rest] = deterministic
  if (!first)
    return { reason: 'unsupported_request', status: 'unavailable' }
  const basis = JSON.stringify(first.basis)
  if (rest.some(estimate => JSON.stringify(estimate.basis) !== basis))
    return { reason: 'ambiguous_pricing', status: 'unavailable' }
  return {
    amountUsd: addProviderCostDecimals(deterministic.map(estimate => estimate.amountUsd)),
    basis: first.basis,
    currency: 'USD',
    quantity: addProviderCostDecimals(deterministic.map(estimate => estimate.quantity)),
    status: 'estimated',
  }
}
