import type {
  NormalizedGenerationOutput,
  NormalizedGenerationProviderAdapter,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import type { PinnedGenerationProviderRoute } from './generation-adapter-contracts.js'
import { selectMockGenerationFixture } from './mock-fixture-catalog.js'

function mockText(request: NormalizedGenerationRequest, outputIndex: number) {
  const semanticText = request.textSlots
    .map(slot => `${slot.slotId}: ${slot.resolvedText}`)
    .join('\n')
  return [
    'TaleLabs deterministic mock output.',
    `Job: ${request.requestId}`,
    `Node: ${request.nodeId}`,
    `Model: ${request.productModelId}`,
    `Operation: ${request.operationId}`,
    `Hash: ${request.requestPayloadHash.slice(0, 16)}`,
    `Output: ${outputIndex}`,
    semanticText,
  ].filter(Boolean).join('\n')
}

async function createOutput(
  request: NormalizedGenerationRequest,
  outputIndex: number,
): Promise<NormalizedGenerationOutput> {
  return {
    mediaType: 'text',
    outputIndex,
    payload: {
      delivery: 'text',
      mimeType: 'text/plain',
      text: mockText(request, outputIndex),
    },
  }
}

/**
 * Deterministic M5 implementation of the same normalized contract used by M6.
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
    // TODO(provider-integration): Replace deterministic mocks with pinned M6
    // provider adapters without changing the run contract.
    submit: async (request) => {
      if (
        request.modelContractVersion !== input.route.modelContractVersion
        || request.operationId !== input.route.operationId
        || request.productModelId !== input.route.productModelId
      ) {
        throw new Error('generation_provider_request_route_mismatch')
      }
      const outputs: NormalizedGenerationOutput[] = []
      for (let outputIndex = 0; outputIndex < request.outputCount; outputIndex += 1) {
        if (input.route.outputType === 'text') {
          outputs.push(await createOutput(request, outputIndex))
        }
        else {
          const fixture = selectMockGenerationFixture({
            mediaType: input.route.outputType,
            outputIndex,
            requestPayloadHash: request.requestPayloadHash,
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
      return { outputs, status: 'completed' }
    },
  }
}
