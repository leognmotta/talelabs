/** Composes organization request admission with the shared cache backend. */

import type { RateLimitStore } from '@talelabs/cache'

import { FixedWindowRateLimitStore, rateLimitCache } from '@talelabs/cache'
import { ORGANIZATION_API_RATE_LIMIT_POLICY } from './rate-limit-policy.js'

/** Organization-scoped API rate limiter sharing the application cache. */
export const organizationApiRateLimitStore: RateLimitStore
  = new FixedWindowRateLimitStore({
    cache: rateLimitCache,
    keyNamespace: 'rate-limit:organization-api:v1',
    policy: ORGANIZATION_API_RATE_LIMIT_POLICY,
  })
