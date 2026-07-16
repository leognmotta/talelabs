import type { NormalizedGenerationRequest } from '@talelabs/flows'

import type { PinnedGenerationProviderRoute } from '../../contracts.js'
import type { OpenRouterVideoInputs } from './input-types.js'
import { OpenRouterHttpError } from '@talelabs/openrouter'
import { logger } from '@trigger.dev/sdk'

export function logOpenRouterVideoSubmission(input: {
  duration: number
  inputs: OpenRouterVideoInputs
  request: NormalizedGenerationRequest
  resolution: string
  route: Readonly<PinnedGenerationProviderRoute>
}) {
  logger.info('openrouter.video.submit', {
    durationSeconds: input.duration,
    event: 'openrouter.video.submit',
    frameImageCount: input.inputs.frameImages.length,
    layer: 'trigger',
    operationId: input.request.operationId,
    productModelId: input.request.productModelId,
    providerEndpointTag: input.route.providerEndpointTag ?? null,
    referenceCounts: input.inputs.referenceCounts,
    resolution: input.resolution,
    timestamp: new Date().toISOString(),
  })
}

export function logOpenRouterVideoHttpError(
  error: unknown,
  operation: 'poll' | 'submit',
) {
  if (!(error instanceof OpenRouterHttpError))
    return
  logger.error('openrouter.video.http_error', {
    code: error.code,
    event: 'openrouter.video.http_error',
    layer: 'trigger',
    operation,
    status: error.status,
    timestamp: new Date().toISOString(),
  })
}
