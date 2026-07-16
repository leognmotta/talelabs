import type {
  NormalizedGenerationMediaAsset,
  NormalizedGenerationProviderAdapter,
} from '@talelabs/flows'

import type { createOpenRouterHttpClient, OpenRouterImageRequestProfile } from '@talelabs/openrouter'
import type { ResolvedGenerationAsset } from '../../../inputs/asset-resolver.js'
import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import { createOpenRouterImagePreparation } from './submission.js'

export function createOpenRouterImageAdapter(input: {
  client?: ReturnType<typeof createOpenRouterHttpClient>
  profile: OpenRouterImageRequestProfile
  resolveAsset: (
    asset: NormalizedGenerationMediaAsset,
  ) => Promise<ResolvedGenerationAsset>
  route: Readonly<PinnedGenerationProviderRoute>
}): NormalizedGenerationProviderAdapter {
  const prepare = createOpenRouterImagePreparation(input)
  return {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries: ['bytes'],
      submission: 'immediate',
    },
    prepare,
    submit: async (request) => {
      const submit = await prepare(request)
      return submit()
    },
  }
}
