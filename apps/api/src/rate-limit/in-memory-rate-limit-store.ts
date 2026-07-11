import type { RateLimitPolicy } from './rate-limit-policy.js'
import type {
  RateLimitDecision,
  RateLimitStore,
} from './rate-limit-store.js'

interface FixedWindowEntry {
  count: number
  resetAt: number
}

/**
 * Temporary MVP storage. Every API replica has an independent allowance and
 * all counters reset whenever that replica restarts or is deployed.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, FixedWindowEntry>()
  private nextCleanupAt = 0

  constructor(
    private readonly policy: RateLimitPolicy,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {
    if (maxEntries < 1)
      throw new Error('In-memory rate-limit capacity must be positive.')
  }

  consume(identifier: string): Promise<RateLimitDecision> {
    const now = this.now()
    this.cleanupIfNeeded(now)

    const current = this.entries.get(identifier)
    if (!current || current.resetAt <= now) {
      if (current)
        this.entries.delete(identifier)

      this.evictToCapacity()

      const resetAt = now + this.policy.windowMs
      this.entries.set(identifier, { count: 1, resetAt })
      return Promise.resolve(this.decision(true, 1, resetAt))
    }

    if (current.count >= this.policy.requestLimit)
      return Promise.resolve(this.decision(false, current.count, current.resetAt))

    current.count += 1
    return Promise.resolve(this.decision(true, current.count, current.resetAt))
  }

  private cleanupIfNeeded(now: number) {
    if (now < this.nextCleanupAt && this.entries.size < this.maxEntries)
      return

    for (const [identifier, entry] of this.entries) {
      if (entry.resetAt <= now)
        this.entries.delete(identifier)
    }

    this.nextCleanupAt = now + this.policy.windowMs
  }

  private decision(
    allowed: boolean,
    count: number,
    resetAt: number,
  ): RateLimitDecision {
    return {
      allowed,
      limit: this.policy.requestLimit,
      remaining: Math.max(0, this.policy.requestLimit - count),
      resetAt,
    }
  }

  private evictToCapacity() {
    while (this.entries.size >= this.maxEntries) {
      const oldestIdentifier = this.entries.keys().next().value
      if (oldestIdentifier === undefined)
        return

      this.entries.delete(oldestIdentifier)
    }
  }
}
