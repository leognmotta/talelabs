/** Browser-safe fal queue adapter using a browser-only credential. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { BrowserFalProviderBinding } from '@talelabs/models-catalog'
import type { FalAssetResolver, FalRuntimeCredential } from './types.js'

import { BROWSER_RUN_MAX_OUTPUT_BYTES } from '@talelabs/flows'
import { createFalQueueAdapter } from './protocols/queue/adapter.js'
import { createFalHttpClient } from './transport/client.js'

/** Builds the captured fal queue protocol using a browser-only credential. */
export function createFalBrowserProviderAdapter(input: {
  binding: BrowserFalProviderBinding
  credential: FalRuntimeCredential
  fetch?: typeof globalThis.fetch
  queueOrigin?: string
  resolveAsset: FalAssetResolver
  signal?: AbortSignal
}): NormalizedGenerationProviderAdapter {
  const queueOrigin = input.queueOrigin ?? input.binding.endpoint
  const client = createFalHttpClient({
    baseUrl: queueOrigin,
    credential: input.credential,
    fetch: input.fetch,
    maxMediaResponseBytes: BROWSER_RUN_MAX_OUTPUT_BYTES,
    signal: input.signal,
  })
  return createFalQueueAdapter({
    binding: input.binding,
    client,
    queueOrigin,
    resolveAsset: input.resolveAsset,
  })
}
