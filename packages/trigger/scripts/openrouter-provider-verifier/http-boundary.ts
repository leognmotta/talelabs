import assert from 'node:assert/strict'
import {
  createOpenRouterHttpClient,
  OpenRouterHttpError,
} from '@talelabs/openrouter'
import { z } from 'zod'

async function malformedFetch() {
  return new Response('{', {
    headers: { 'content-type': 'application/json' },
  })
}

async function rateLimitedFetch() {
  return new Response(JSON.stringify({
    error: { code: 429, message: 'discarded' },
  }), {
    headers: { 'retry-after': '2' },
    status: 429,
  })
}

export async function verifyHttpBoundary() {
  const schema = z.object({ ok: z.literal(true) })
  const malformed = createOpenRouterHttpClient({
    apiKey: 'verification-key',
    fetch: malformedFetch,
  })
  await assert.rejects(
    () => malformed.requestJson({
      method: 'GET',
      path: '/api/v1/verification',
      schema,
    }),
    (error: unknown) => error instanceof OpenRouterHttpError
      && error.code === 'malformed_response',
  )
  const rateLimited = createOpenRouterHttpClient({
    apiKey: 'verification-key',
    fetch: rateLimitedFetch,
  })
  await assert.rejects(
    () => rateLimited.requestBytes({
      method: 'GET',
      path: '/api/v1/verification',
    }),
    (error: unknown) => error instanceof OpenRouterHttpError
      && error.code === 'rate_limited'
      && error.retryAfterMs === 2_000,
  )
}
