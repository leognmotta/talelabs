/**
 * Provider-level dispatcher from an immutable fal binding to the queue protocol.
 */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { CatalogFalProviderBinding } from '@talelabs/models-catalog'
import type { FalHttpClient } from './transport/contracts.js'
import type { FalAssetResolver, FalRuntimeCredential } from './types.js'

import { createFalQueueAdapter } from './protocols/queue/adapter.js'
import { createFalHttpClient } from './transport/client.js'

type FalProviderAdapterRuntime
  = | {
    client: FalHttpClient
    credential?: never
  }
  | {
    client?: never
    credential: FalRuntimeCredential
  }

/** Stable provider discriminator persisted in generation jobs and snapshots. */
export const FAL_PROVIDER = 'fal' as const

/**
 * Creates the fal queue adapter from the captured run binding. Managed
 * composition passes a runtime credential; verification passes a pre-built
 * client and matching origin so no paid request is made.
 */
export function createFalProviderAdapter(input: {
  binding: CatalogFalProviderBinding
  queueOrigin?: string
  resolveAsset: FalAssetResolver
} & FalProviderAdapterRuntime): NormalizedGenerationProviderAdapter {
  const queueOrigin = input.queueOrigin ?? input.binding.endpoint
  const client = input.client
    ?? createFalHttpClient({
      baseUrl: queueOrigin,
      credential: input.credential,
    })
  return createFalQueueAdapter({
    binding: input.binding,
    client,
    queueOrigin,
    resolveAsset: input.resolveAsset,
  })
}
