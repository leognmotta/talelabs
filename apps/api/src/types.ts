/** Shared Hono request context populated by authentication middleware. */

import type { AuthSession } from '@talelabs/auth'

/** Hono environment for authenticated, tenant-scoped TaleLabs API requests. */
export interface ApiEnv {
  Variables: {
    authSession: AuthSession | null
    isSystemAdmin: boolean
    organizationId: string
    userId: string
  }
}
