import type {
  NormalizedGenerationOutput,
  NormalizedGenerationRequest,
} from '@talelabs/flows'

import type { ResolvedGenerationProviderAdapter } from './generation-adapter-contracts.js'
import { validateGenerationProviderOutputs } from '@talelabs/flows'

/**
 * Owns provider submission/completion semantics. M5 uses immediate mocks; M6
 * extends this runner for bounded poll/webhook completion without touching the
 * generation task coordinator.
 */
export async function runGenerationProviderLifecycle(input: {
  resolvedAdapter: ResolvedGenerationProviderAdapter
  request: NormalizedGenerationRequest
}): Promise<readonly NormalizedGenerationOutput[]> {
  const { adapter, route } = input.resolvedAdapter
  if (
    input.request.modelContractVersion !== route.modelContractVersion
    || input.request.operationId !== route.operationId
    || input.request.productModelId !== route.productModelId
  ) {
    throw new Error('generation_provider_request_route_mismatch')
  }
  const submission = await adapter.submit(input.request)
  if (submission.status === 'completed') {
    return validateGenerationProviderOutputs({
      allowedDeliveries: adapter.lifecycle.deliveries,
      expectedCount: input.request.outputCount,
      expectedMediaType: route.outputType,
      outputs: submission.outputs,
    })
  }

  if (!('poll' in adapter) || !adapter.poll)
    throw new Error('generation_provider_webhook_wait_not_implemented')

  const completion = await adapter.poll(submission.externalJobId)
  if (completion.status === 'completed') {
    return validateGenerationProviderOutputs({
      allowedDeliveries: adapter.lifecycle.deliveries,
      expectedCount: input.request.outputCount,
      expectedMediaType: route.outputType,
      outputs: completion.outputs,
    })
  }
  if (completion.status === 'failed')
    throw new Error(`generation_provider_failed:${completion.code}`)
  throw new Error('generation_provider_poll_pending_not_implemented')
}
