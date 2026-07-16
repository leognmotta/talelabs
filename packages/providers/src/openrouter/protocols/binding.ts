/**
 * Immutable provider-binding validation shared by OpenRouter protocols.
 *
 */

import type { NormalizedGenerationRequest } from '@talelabs/flows'
import type {
  CatalogOpenRouterProtocol,
  CatalogOpenRouterProviderBinding,
} from '@talelabs/models-catalog'

import { throwProviderResponseInvalid } from '../errors.js'

/** Validates request identity against the exact admitted provider binding. */
export function assertRequestMatchesBinding(
  request: NormalizedGenerationRequest,
  binding: CatalogOpenRouterProviderBinding,
  protocol: CatalogOpenRouterProtocol,
) {
  if (
    binding.provider !== 'openrouter'
    || binding.protocol !== protocol
    || binding.requestProfile.kind !== protocol
    || request.operationId !== binding.operationId
  ) {
    throwProviderResponseInvalid()
  }
}

/** Builds pinned OpenRouter routing policy with fallbacks disabled. */
export function pinnedOpenRouterProvider(
  binding: CatalogOpenRouterProviderBinding,
  requireParameters = false,
) {
  return {
    allow_fallbacks: false,
    only: [binding.providerTag],
    ...(requireParameters ? { require_parameters: true } : {}),
  }
}
