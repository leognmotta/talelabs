/** Fake-HTTP verification for Fal's batched billing-events lookup. */

import assert from 'node:assert/strict'

import { createFalGenerationCostLookup } from '@talelabs/providers/server'

/** Verifies Fal request-level billing events yield discounted actual USD cost. */
export async function verifyFalAccountingLookup() {
  const captured: {
    authorization: string | null
    requests: number
    requestedUrl: URL | null
  } = {
    authorization: null,
    requests: 0,
    requestedUrl: null,
  }
  const lookup = createFalGenerationCostLookup({
    credential: {
      provider: 'fal',
      resolveApiKey: () => 'verification-key',
    },
    fetch: async (url, init) => {
      captured.requests += 1
      captured.requestedUrl = new URL(String(url))
      captured.authorization = new Headers(init?.headers).get('authorization')
      return new Response(JSON.stringify({
        billing_events: [
          {
            cost_estimate_nano_usd: 2_500_000,
            endpoint_id: 'fal-ai/verification-model-b',
            request_id: 'fal-request-accounting-b',
          },
          {
            cost_estimate_nano_usd: 1_350_000,
            endpoint_id: 'fal-ai/verification-model-a',
            request_id: 'fal-request-accounting-a',
          },
        ],
        has_more: false,
        next_cursor: null,
      }), { headers: { 'content-type': 'application/json' } })
    },
  })
  assert.deepEqual(await lookup.lookupMany([
    {
      endpointId: 'fal-ai/verification-model-a',
      requestId: 'fal-request-accounting-a',
      submittedAt: new Date('2026-07-20T12:00:00.000Z'),
    },
    {
      endpointId: 'fal-ai/verification-model-b',
      requestId: 'fal-request-accounting-b',
      submittedAt: new Date('2026-07-20T12:01:00.000Z'),
    },
  ]), [0.00135, 0.0025])
  assert.equal(captured.authorization, 'Key verification-key')
  assert.equal(captured.requests, 1)
  assert.ok(captured.requestedUrl)
  assert.equal(captured.requestedUrl.hostname, 'api.fal.ai')
  assert.deepEqual(
    captured.requestedUrl.searchParams.getAll('request_id'),
    ['fal-request-accounting-a', 'fal-request-accounting-b'],
  )
  assert.deepEqual(
    captured.requestedUrl.searchParams.getAll('endpoint_id'),
    ['fal-ai/verification-model-a', 'fal-ai/verification-model-b'],
  )
  assert.equal(captured.requestedUrl.searchParams.get('limit'), '2')
}
