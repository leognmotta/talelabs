/** Debug-mode resolver scenarios covering every current generation route. */

import assert from 'node:assert/strict'

import { resolveGenerationProviderAdapter } from '../../src/generation/adapters/registry.js'
import { providerRequest } from './requests.js'
import { currentRoutes, pinnedRoute } from './routes.js'

/** Proves every catalog route swaps to one repeatable, zero-cost mock result. */
export async function verifyDebugModeResolver() {
  for (const route of currentRoutes()) {
    const resolved = resolveGenerationProviderAdapter({
      ...pinnedRoute(route),
      executionMode: 'debug',
      organizationId: 'organization-verification',
    })
    assert.equal(resolved.adapter.lifecycle.submission, 'immediate')
    assert.equal(resolved.requiresDurableSubmissionBoundary, false)

    const request = providerRequest({ route })
    const first = await resolved.adapter.submit(request)
    const second = await resolved.adapter.submit({
      ...request,
      requestId: 'different-job',
      requestPayloadHash: 'b'.repeat(64),
    })
    assert.equal(first.status, 'completed')
    assert.equal(second.status, 'completed')
    if (first.status !== 'completed' || second.status !== 'completed')
      continue
    assert.equal(first.facts?.providerCostUsd, 0)
    assert.deepEqual(first.outputs, second.outputs)
    assert.equal(first.outputs[0]?.mediaType, route.model.mediaType)
  }
}
