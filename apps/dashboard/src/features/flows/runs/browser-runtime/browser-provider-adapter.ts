/**
 * Provider dispatch for the browser execution driver.
 *
 * The captured browser binding selects which provider adapter runs; the resolved
 * BYOK key is injected per provider. Adding a browser-capable provider adds one
 * case here and does not change the run loop.
 */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { BrowserCatalogProviderBinding } from '@talelabs/models-catalog'
import type { ProviderAssetResolver } from '@talelabs/providers/browser'

import {
  createFalBrowserProviderAdapter,
  createOpenRouterBrowserProviderAdapter,
} from '@talelabs/providers/browser'

/** Builds the browser provider adapter for one captured browser binding. */
export function createBrowserProviderAdapter(input: {
  apiKey: string
  binding: BrowserCatalogProviderBinding
  resolveAsset: ProviderAssetResolver
  signal?: AbortSignal
}): NormalizedGenerationProviderAdapter {
  switch (input.binding.provider) {
    case 'fal':
      return createFalBrowserProviderAdapter({
        binding: input.binding,
        credential: { provider: 'fal', resolveApiKey: () => input.apiKey },
        resolveAsset: input.resolveAsset,
        signal: input.signal,
      })
    case 'openrouter':
      return createOpenRouterBrowserProviderAdapter({
        binding: input.binding,
        credential: { provider: 'openrouter', resolveApiKey: () => input.apiKey },
        resolveAsset: input.resolveAsset,
        signal: input.signal,
      })
  }
}
