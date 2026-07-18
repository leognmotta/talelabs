/** Browser-safe OpenRouter binding dispatcher without server accounting imports. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { BrowserOpenRouterProviderBinding } from '@talelabs/models-catalog'
import type { OpenRouterAssetResolver, OpenRouterRuntimeCredential } from './types.js'

import { BROWSER_RUN_MAX_OUTPUT_BYTES } from '@talelabs/flows'
import { createOpenRouterChatAdapter } from './protocols/chat.js'
import { createOpenRouterImageAdapter } from './protocols/image.js'
import { createOpenRouterSpeechAdapter } from './protocols/speech.js'
import { createOpenRouterVideoAdapter } from './protocols/video/index.js'
import { createOpenRouterHttpClient } from './transport/client.js'

/** Builds the captured OpenRouter protocol using a browser-only credential. */
export function createOpenRouterBrowserProviderAdapter(input: {
  binding: BrowserOpenRouterProviderBinding
  credential: OpenRouterRuntimeCredential
  resolveAsset: OpenRouterAssetResolver
  signal?: AbortSignal
}): NormalizedGenerationProviderAdapter {
  const client = createOpenRouterHttpClient({
    credential: input.credential,
    maxMediaResponseBytes: BROWSER_RUN_MAX_OUTPUT_BYTES,
    signal: input.signal,
  })
  const shared = { client, resolveAsset: input.resolveAsset }
  switch (input.binding.protocol) {
    case 'image':
      return createOpenRouterImageAdapter({ ...shared, binding: input.binding })
    case 'video':
      return createOpenRouterVideoAdapter({ ...shared, binding: input.binding })
    case 'speech':
      return createOpenRouterSpeechAdapter({ binding: input.binding, client })
    case 'chat':
      return createOpenRouterChatAdapter({ ...shared, binding: input.binding })
  }
}
