/**
 * Server-only registry dispatching captured bindings to provider adapters.
 */

import type {
  ProviderAdapterRuntimeInput,
  RegisteredProviderAdapter,
} from './contracts.js'

import { createFalProviderAdapter } from '../fal/adapter.js'
import { createOpenRouterProviderAdapter } from '../openrouter/adapter.js'
import { resolveProviderRuntimeCredential } from './credentials.js'

/** Creates the registered provider adapter for one captured catalog binding. */
export function createProviderAdapter(
  input: ProviderAdapterRuntimeInput,
): RegisteredProviderAdapter {
  switch (input.binding.provider) {
    case 'fal': {
      const credential = resolveProviderRuntimeCredential(
        input.binding.provider,
        input.credential,
      )
      return {
        adapter: createFalProviderAdapter({
          binding: input.binding,
          credential,
          resolveAsset: input.resolveAsset,
        }),
        requiresDurableSubmissionBoundary:
          input.binding.requiresDurableSubmissionBoundary,
      }
    }
    case 'openrouter': {
      const credential = resolveProviderRuntimeCredential(
        input.binding.provider,
        input.credential,
      )
      return {
        adapter: createOpenRouterProviderAdapter({
          binding: input.binding,
          credential,
          resolveAsset: input.resolveAsset,
        }),
        requiresDurableSubmissionBoundary:
          input.binding.requiresDurableSubmissionBoundary,
      }
    }
  }
}
