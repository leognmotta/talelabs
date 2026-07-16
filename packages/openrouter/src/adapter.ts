/**
 * Provider-level dispatcher from immutable bindings to shared protocols.
 *
 */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type { createOpenRouterHttpClient } from './transport/client.js'
import type {
  OpenRouterAssetResolver,
  OpenRouterChatBinding,
  OpenRouterImageBinding,
  OpenRouterSpeechBinding,
  OpenRouterVideoBinding,
} from './types.js'

import { createOpenRouterChatAdapter } from './protocols/chat.js'
import { createOpenRouterImageAdapter } from './protocols/image.js'
import { createOpenRouterSpeechAdapter } from './protocols/speech.js'
import { createOpenRouterVideoAdapter } from './protocols/video/index.js'

/** Stable provider discriminator persisted in generation jobs and snapshots. */
export const OPENROUTER_PROVIDER = 'openrouter' as const

/** Creates one OpenRouter protocol adapter from the captured run binding. */
export function createOpenRouterProviderAdapter(input: {
  binding: CatalogProviderBinding
  client?: ReturnType<typeof createOpenRouterHttpClient>
  resolveAsset: OpenRouterAssetResolver
}): NormalizedGenerationProviderAdapter {
  const shared = { client: input.client, resolveAsset: input.resolveAsset }
  switch (input.binding.protocol) {
    case 'image':
      return createOpenRouterImageAdapter({
        ...shared,
        binding: input.binding as OpenRouterImageBinding,
      })
    case 'video':
      return createOpenRouterVideoAdapter({
        ...shared,
        binding: input.binding as OpenRouterVideoBinding,
      })
    case 'speech':
      return createOpenRouterSpeechAdapter({
        binding: input.binding as OpenRouterSpeechBinding,
        client: input.client,
      })
    case 'chat':
      return createOpenRouterChatAdapter({
        ...shared,
        binding: input.binding as OpenRouterChatBinding,
      })
  }
}
