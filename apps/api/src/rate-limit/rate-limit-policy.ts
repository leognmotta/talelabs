export interface RateLimitPolicy {
  requestLimit: number
  windowMs: number
}

export const ORGANIZATION_API_RATE_LIMIT_POLICY = {
  requestLimit: 600,
  windowMs: 60_000,
} as const satisfies RateLimitPolicy

export const IN_MEMORY_RATE_LIMIT_STORE_MAX_ENTRIES = 20_000
