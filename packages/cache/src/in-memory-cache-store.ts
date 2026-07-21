/** Bounded process-local implementation of the shared cache contract. */

import type {
  CacheIncrementOptions,
  CacheIncrementResult,
  CacheSetOptions,
  CacheStore,
} from './contracts.js'

interface InMemoryCacheEntry {
  expiresAt: number
  value: unknown
}

const CLEANUP_INTERVAL_MS = 30_000

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`${label} must be a positive integer.`)
}

function assertTtl(options: CacheSetOptions): void {
  assertPositiveInteger(options.ttlMs, 'Cache TTL')
}

/**
 * Stores expiring values and atomic counters within one Node.js process.
 * Entries are bounded and least-recently-used entries are evicted at capacity.
 */
export class InMemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, InMemoryCacheEntry>()
  private nextCleanupAt = 0

  constructor(
    input: {
      /** Maximum values and counters retained by this process. */
      maxEntries: number
      /** Injectable epoch-millisecond clock used by deterministic verification. */
      now?: () => number
    },
  ) {
    assertPositiveInteger(input.maxEntries, 'In-memory cache capacity')
    this.maxEntries = input.maxEntries
    this.now = input.now ?? Date.now
  }

  private readonly maxEntries: number
  private readonly now: () => number

  /** Deletes one exact cache entry. */
  delete(key: string): Promise<void> {
    this.entries.delete(key)
    return Promise.resolve()
  }

  /** Reads and touches one unexpired cache entry. */
  get<Value>(key: string): Promise<Value | undefined> {
    const now = this.now()
    const entry = this.entries.get(key)
    if (!entry)
      return Promise.resolve(undefined)
    if (entry.expiresAt <= now) {
      this.entries.delete(key)
      return Promise.resolve(undefined)
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return Promise.resolve(entry.value as Value)
  }

  /** Atomically increments one expiring numeric entry within this process. */
  increment(
    key: string,
    options: CacheIncrementOptions,
  ): Promise<CacheIncrementResult> {
    assertTtl(options)
    if (options.maximum !== undefined)
      assertPositiveInteger(options.maximum, 'Cache counter maximum')

    const now = this.now()
    this.cleanupIfNeeded(now)
    const existing = this.entries.get(key)
    if (!existing || existing.expiresAt <= now) {
      if (existing)
        this.entries.delete(key)
      this.ensureCapacity()
      const entry = { expiresAt: now + options.ttlMs, value: 1 }
      this.entries.set(key, entry)
      return Promise.resolve({
        expiresAt: entry.expiresAt,
        incremented: true,
        value: 1,
      })
    }
    if (typeof existing.value !== 'number' || !Number.isInteger(existing.value))
      throw new Error('Cache counter key contains a non-integer value.')

    const incremented = options.maximum === undefined
      || existing.value < options.maximum
    if (incremented)
      existing.value += 1
    this.entries.delete(key)
    this.entries.set(key, existing)
    return Promise.resolve({
      expiresAt: existing.expiresAt,
      incremented,
      value: existing.value,
    })
  }

  /** Writes and touches one value until its bounded expiration. */
  set<Value>(
    key: string,
    value: Value,
    options: CacheSetOptions,
  ): Promise<void> {
    assertTtl(options)
    const now = this.now()
    this.cleanupIfNeeded(now)
    this.entries.delete(key)
    this.ensureCapacity()
    this.entries.set(key, {
      expiresAt: now + options.ttlMs,
      value,
    })
    return Promise.resolve()
  }

  private cleanupIfNeeded(now: number): void {
    if (now < this.nextCleanupAt && this.entries.size < this.maxEntries)
      return
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now)
        this.entries.delete(key)
    }
    this.nextCleanupAt = now + CLEANUP_INTERVAL_MS
  }

  private ensureCapacity(): void {
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (typeof oldestKey !== 'string')
        return
      this.entries.delete(oldestKey)
    }
  }
}
