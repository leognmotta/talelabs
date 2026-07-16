import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationProviderAdapter,
} from '@talelabs/flows'

import type { createOpenRouterHttpClient, OpenRouterChatRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterChatPreparation } from './submission.js'

export function createOpenRouterChatAdapter(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterChatRequestProfile
  resolveAsset: (
    asset: NormalizedGenerationMediaAsset,
  ) => Promise<ResolvedGenerationAsset>
  route: Readonly<PinnedGenerationProviderRoute>
}): NormalizedGenerationProviderAdapter {
  const prepare = createOpenRouterChatPreparation(input)
  return {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['text'],
      submission: 'immediate',
    },
    prepare,
    submit: async (request) => {
      const submit = await prepare(request)
      return submit()
    },
  }
}
