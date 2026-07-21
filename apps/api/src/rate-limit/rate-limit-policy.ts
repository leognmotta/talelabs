/** API-owned request allowance applied through the shared cache limiter. */

import type { RateLimitPolicy } from '@talelabs/cache'

/** Fixed per-organization product API allowance. */
export const ORGANIZATION_API_RATE_LIMIT_POLICY = {
  requestLimit: 600,
  windowMs: 60_000,
} as const satisfies RateLimitPolicy
