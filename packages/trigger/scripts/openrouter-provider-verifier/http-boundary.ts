/** Verifies bounded malformed and rate-limited OpenRouter HTTP responses. */

import assert from 'node:assert/strict'
import {
  createOpenRouterHttpClient,
  OpenRouterHttpError,
} from '@talelabs/providers/server'
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

async function binaryFetch() {
  return new Response(new Uint8Array([1, 2]), {
    headers: {
      'content-length': '2',
      'content-type': 'application/octet-stream',
    },
  })
}

/** Verifies malformed and rate-limited responses without external network I/O. */
export async function verifyHttpBoundary() {
  const schema = z.object({ ok: z.literal(true) })
  const malformed = createOpenRouterHttpClient({
    credential: {
      provider: 'openrouter',
      resolveApiKey: () => 'verification-key',
    },
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
    credential: {
      provider: 'openrouter',
      resolveApiKey: () => 'verification-key',
    },
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
  const browserBounded = createOpenRouterHttpClient({
    credential: {
      provider: 'openrouter',
      resolveApiKey: () => 'verification-key',
    },
    fetch: binaryFetch,
    maxMediaResponseBytes: 1,
  })
  await assert.rejects(
    () => browserBounded.requestBytes({
      method: 'GET',
      path: '/api/v1/verification',
    }),
    (error: unknown) => error instanceof OpenRouterHttpError
      && error.code === 'response_too_large',
  )
}
