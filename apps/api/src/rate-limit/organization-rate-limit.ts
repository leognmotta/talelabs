import type { RateLimitStore } from './rate-limit-store.js'

import { InMemoryRateLimitStore } from './in-memory-rate-limit-store.js'
import {
  IN_MEMORY_RATE_LIMIT_STORE_MAX_ENTRIES,
  ORGANIZATION_API_RATE_LIMIT_POLICY,
} from './rate-limit-policy.js'

// TODO: Replace InMemoryRateLimitStore with shared Redis storage before running multiple API instances. Process-local limits are not globally enforced and reset during deployments.
export const organizationApiRateLimitStore: RateLimitStore
  = new InMemoryRateLimitStore(
    ORGANIZATION_API_RATE_LIMIT_POLICY,
    IN_MEMORY_RATE_LIMIT_STORE_MAX_ENTRIES,
  )
