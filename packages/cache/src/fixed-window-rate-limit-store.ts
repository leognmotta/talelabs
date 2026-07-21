/** Fixed-window rate limiting backed by the shared atomic cache counter. */

import type { CacheStore } from './contracts.js'

import { createCacheKey } from './cache-key.js'

/** One fixed-window rate-limit decision returned to HTTP admission. */
export interface RateLimitDecision {
  /** Whether this request consumed an allowance. */
  allowed: boolean
  /** Maximum allowed requests in the current window. */
  limit: number
  /** Requests still available before the current window expires. */
  remaining: number
  /** Epoch timestamp in milliseconds when a fresh window begins. */
  resetAt: number
}

/** Code-owned fixed-window request policy. */
export interface RateLimitPolicy {
  /** Maximum requests accepted per identifier in one window. */
  requestLimit: number
  /** Fixed-window duration in milliseconds. */
  windowMs: number
}

/** Rate-limit admission boundary consumed by API middleware. */
export interface RateLimitStore {
  /** Consumes one request allowance for a stable identifier. */
  consume: (identifier: string) => Promise<RateLimitDecision>
}

/** Fixed-window limiter whose counter storage can move from memory to Redis. */
export class FixedWindowRateLimitStore implements RateLimitStore {
  constructor(input: {
    /** Shared cache supplying atomic expiring counters. */
    cache: CacheStore
    /** Namespace isolating this limiter from other cache workloads. */
    keyNamespace: string
    /** Request allowance and window duration. */
    policy: RateLimitPolicy
  }) {
    if (!Number.isInteger(input.policy.requestLimit) || input.policy.requestLimit < 1)
      throw new Error('Rate-limit request allowance must be a positive integer.')
    if (!Number.isInteger(input.policy.windowMs) || input.policy.windowMs < 1)
      throw new Error('Rate-limit window must be a positive integer.')
    this.cache = input.cache
    this.keyNamespace = input.keyNamespace
    this.policy = input.policy
  }

  private readonly cache: CacheStore
  private readonly keyNamespace: string
  private readonly policy: RateLimitPolicy

  /** Atomically consumes one allowance without extending the fixed window. */
  async consume(identifier: string): Promise<RateLimitDecision> {
    const counter = await this.cache.increment(
      createCacheKey(this.keyNamespace, [identifier]),
      {
        maximum: this.policy.requestLimit,
        ttlMs: this.policy.windowMs,
      },
    )
    return {
      allowed: counter.incremented,
      limit: this.policy.requestLimit,
      remaining: Math.max(0, this.policy.requestLimit - counter.value),
      resetAt: counter.expiresAt,
    }
  }
}
