/** Replaceable cache contracts shared by server-side TaleLabs workloads. */

/** Options controlling the lifetime of one cached value. */
export interface CacheSetOptions {
  /** Positive lifetime in milliseconds, measured from the write. */
  ttlMs: number
}

/** Options for one atomic expiring counter increment. */
export interface CacheIncrementOptions extends CacheSetOptions {
  /** Optional positive ceiling after which increments are rejected. */
  maximum?: number
}

/** Result of one atomic expiring counter increment. */
export interface CacheIncrementResult {
  /** Epoch timestamp in milliseconds at which the fixed window expires. */
  expiresAt: number
  /** Whether this call incremented the counter rather than hitting its ceiling. */
  incremented: boolean
  /** Counter value after this operation, capped by `maximum` when supplied. */
  value: number
}

/** Shared asynchronous cache boundary implemented in memory now and Redis later. */
export interface CacheStore {
  /** Deletes one exact namespaced cache key. */
  delete: (key: string) => Promise<void>
  /** Reads one exact key, returning `undefined` after a miss or expiration. */
  get: <Value>(key: string) => Promise<Value | undefined>
  /** Atomically increments one fixed-window counter without extending its TTL. */
  increment: (
    key: string,
    options: CacheIncrementOptions,
  ) => Promise<CacheIncrementResult>
  /** Writes one value with a mandatory bounded lifetime. */
  set: <Value>(
    key: string,
    value: Value,
    options: CacheSetOptions,
  ) => Promise<void>
}
