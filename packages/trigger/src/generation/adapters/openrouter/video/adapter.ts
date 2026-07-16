import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationProviderAdapter,
} from '@talelabs/flows'

import type { createOpenRouterHttpClient, OpenRouterVideoRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterVideoPoll } from './poll.js'
import { createOpenRouterVideoPreparation } from './submission.js'

export function createOpenRouterVideoAdapter(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterVideoRequestProfile
  resolveAsset: (
    asset: NormalizedGenerationMediaAsset,
  ) => Promise<ResolvedGenerationAsset>
  route: Readonly<PinnedGenerationProviderRoute>
}): NormalizedGenerationProviderAdapter {
  const prepare = createOpenRouterVideoPreparation(input)
  const delivery = input.route.providerLifecycle?.deliveries.includes('stream')
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
