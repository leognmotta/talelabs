/** Deterministic zero-cost normalized provider adapter for debug runs. */

import type {
  NormalizedGenerationOutput,
  NormalizedGenerationProviderAdapter,
} from '@talelabs/flows'

import type { PinnedGenerationProviderRoute } from '../contracts.js'
import { selectMockGenerationFixture } from './fixture-catalog.js'
import { createDeterministicMockTextOutput } from './text.js'

/**
 * Deterministic implementation of the normalized provider adapter contract.
 * The output kind is injected by the resolver because product model IDs are
 * intentionally independent from provider-native naming.
 */
export function createDeterministicMockAdapter(input: {
  route: Readonly<PinnedGenerationProviderRoute>
}): NormalizedGenerationProviderAdapter {
  const deliveries = input.route.outputType === 'text'
    ? ['text'] as const
    : ['storage'] as const
  return {
    lifecycle: {
      cancellation: 'unsupported',
      completions: ['response'],
      deliveries,
      submission: 'immediate',
    },
    submit: async (request) => {
      if (
        request.catalogRevision !== input.route.catalogRevision
        || request.catalogVersion !== input.route.catalogVersion
        || request.modelContractVersion !== input.route.modelContractVersion
        || request.modelRevision !== input.route.modelRevision
        || request.operationId !== input.route.operationId
        || request.productModelId !== input.route.productModelId
      ) {
        throw new Error('generation_provider_request_route_mismatch')
      }
      const outputs: NormalizedGenerationOutput[] = []
      for (let outputIndex = 0; outputIndex < request.outputCount; outputIndex += 1) {
        if (input.route.outputType === 'text') {
          outputs.push(await createDeterministicMockTextOutput(
            outputIndex,
          ))
        }
        else {
          const fixture = selectMockGenerationFixture({
            mediaType: input.route.outputType,
            outputIndex,
          })
          outputs.push({
            mediaType: input.route.outputType,
            metadata: {
              fixtureCatalogVersion: fixture.catalogVersion,
              fixtureChecksumSha256: fixture.checksumSha256,
              fixtureId: fixture.id,
              ...(fixture.durationSeconds === undefined
                ? {}
                : { durationSeconds: fixture.durationSeconds }),
              ...(fixture.height === undefined ? {} : { height: fixture.height }),
              ...(fixture.width === undefined ? {} : { width: fixture.width }),
            },
            outputIndex,
            payload: {
              bucket: fixture.storage.bucket,
              delivery: 'storage',
              key: fixture.storage.key,
              mimeType: fixture.mimeType,
            },
          })
        }
      }
      return {
        facts: { providerCostUsd: 0 },
        outputs,
        status: 'completed',
      }
    },
  }
}
