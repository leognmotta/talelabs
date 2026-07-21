/** Organization-scoped request limiting and standard rate-limit headers. */

import type { RateLimitDecision, RateLimitStore } from '@talelabs/cache'
import type { Context } from 'hono'
import type { ApiEnv } from '../types.js'

import { createMiddleware } from 'hono/factory'
import { apiError } from './error.js'

function getSecondsUntil(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000))
}

function setRateLimitHeaders(
  c: Context<ApiEnv>,
  decision: RateLimitDecision,
) {
  c.header('RateLimit-Limit', String(decision.limit))
  c.header('RateLimit-Remaining', String(decision.remaining))
  c.header('RateLimit-Reset', String(getSecondsUntil(decision.resetAt)))
}

/** Creates authenticated organization admission middleware for one limiter. */
export function createOrganizationRateLimitMiddleware(store: RateLimitStore) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    const decision = await store.consume(c.var.organizationId)
    setRateLimitHeaders(c, decision)

    if (!decision.allowed) {
      c.header('Retry-After', String(getSecondsUntil(decision.resetAt)))
      return c.json(apiError(
        'rate_limited',
        'Too many requests. Try again later.',
      ), 429)
    }

    await next()
  })
}
