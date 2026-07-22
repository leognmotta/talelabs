/**
 * Provider-level dispatcher from immutable bindings to shared protocols.
 *
 */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { CatalogOpenRouterProviderBinding } from '@talelabs/models-catalog'
import type {
  OpenRouterHttpClient,
} from './transport/contracts.js'
import type {
  OpenRouterAssetResolver,
  OpenRouterRuntimeCredential,
} from './types.js'

import { createOpenRouterAudioAdapter } from './protocols/audio.js'
import { createOpenRouterChatAdapter } from './protocols/chat.js'
import { createOpenRouterImageAdapter } from './protocols/image.js'
import { createOpenRouterSpeechAdapter } from './protocols/speech.js'
import { createOpenRouterSpeechFactsReconciler } from './protocols/speech/accounting.js'
import { createOpenRouterVideoAdapter } from './protocols/video/index.js'
import { createOpenRouterHttpClient } from './transport/client.js'

type OpenRouterProviderAdapterRuntime
  = | {
    client: OpenRouterHttpClient
    credential?: never
  }
  | {
    client?: never
    credential: OpenRouterRuntimeCredential
  }

/** Stable provider discriminator persisted in generation jobs and snapshots. */
export const OPENROUTER_PROVIDER = 'openrouter' as const

/** Creates one OpenRouter protocol adapter from the captured run binding. */
export function createOpenRouterProviderAdapter(input: {
  binding: CatalogOpenRouterProviderBinding
  resolveAsset: OpenRouterAssetResolver
} & OpenRouterProviderAdapterRuntime): NormalizedGenerationProviderAdapter {
  const client = input.client ?? createOpenRouterHttpClient({
    credential: input.credential,
  })
  const shared = { client, resolveAsset: input.resolveAsset }
  switch (input.binding.protocol) {
    case 'audio':
      return createOpenRouterAudioAdapter({ binding: input.binding, client })
    case 'image':
      return createOpenRouterImageAdapter({
        ...shared,
        binding: input.binding,
      })
    case 'video':
      return createOpenRouterVideoAdapter({
        ...shared,
        binding: input.binding,
      })
    case 'speech':
      return createOpenRouterSpeechAdapter({
        binding: input.binding,
        client,
        reconcileFacts: createOpenRouterSpeechFactsReconciler({ client }),
      })
    case 'chat':
      return createOpenRouterChatAdapter({
        ...shared,
        binding: input.binding,
      })
  }
}
