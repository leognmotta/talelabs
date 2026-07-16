/** Public facade for the asynchronous OpenRouter video protocol. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { OpenRouterHttpClient } from '../../transport/contracts.js'
import type {
  OpenRouterAssetResolver,
  OpenRouterVideoBinding,
} from '../../types.js'

import { createOpenRouterVideoPoll } from './poll.js'
import { createOpenRouterVideoPreparation } from './prepare.js'

export { createOpenRouterVideoPoll } from './poll.js'
export { createOpenRouterVideoPreparation } from './prepare.js'

/** Creates the shared asynchronous video protocol adapter. */
export function createOpenRouterVideoAdapter(input: {
  binding: OpenRouterVideoBinding
  client: OpenRouterHttpClient
  resolveAsset: OpenRouterAssetResolver
}): NormalizedGenerationProviderAdapter {
  const prepare = createOpenRouterVideoPreparation(input)
  const delivery = input.binding.lifecycle.deliveries.includes('stream')
    ? 'stream'
    : 'bytes'
  return {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['poll'],
      deliveries: [delivery],
      submission: 'asynchronous',
    },
    poll: createOpenRouterVideoPoll({ ...input, delivery }),
    prepare,
    submit: async (request, context) => {
      const submit = await prepare(request, context)
      return submit()
    },
  }
}
