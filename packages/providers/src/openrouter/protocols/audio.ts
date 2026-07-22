/** Public facade for OpenRouter chat-completions audio output. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { OpenRouterHttpClient } from '../transport/contracts.js'
import type { OpenRouterAudioBinding } from '../types.js'

import { createOpenRouterAudioPreparation } from './audio/prepare.js'
import { createOpenRouterImmediateAdapter } from './immediate-adapter.js'

export { createOpenRouterAudioPreparation } from './audio/prepare.js'
export {
  decodeOpenRouterAudioSse,
  OPENROUTER_MAX_AUDIO_SSE_BYTES,
} from './audio/sse.js'

/** Creates the shared immediate adapter for streaming audio output. */
export function createOpenRouterAudioAdapter(input: {
  /** Exact reviewed audio binding captured in the run snapshot. */
  binding: OpenRouterAudioBinding
  /** Authenticated bounded OpenRouter client. */
  client: OpenRouterHttpClient
}): NormalizedGenerationProviderAdapter {
  return createOpenRouterImmediateAdapter({
    deliveries: ['bytes'],
    prepare: createOpenRouterAudioPreparation(input),
  })
}
