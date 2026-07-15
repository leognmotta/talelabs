export interface PostgresPoolConfig {
  connectionTimeoutMillis: number
  max: number
}

/**
 * Conservative per-process defaults for API and Trigger workers. These are
 * ordinary deployment policy, so they remain typed and code-owned.
 */
export const POSTGRES_POOL_CONFIG = Object.freeze({
  connectionTimeoutMillis: 5_000,
  max: 3,
} satisfies PostgresPoolConfig)
