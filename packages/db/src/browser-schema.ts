/** Browser-executor lease persistence separated from the core run schema. */

import type {
  GeneratedTimestamp,
  Timestamp,
} from './column-types.js'

/** Authoritative browser executor ownership for one tenant-scoped run. */
export interface FlowRunBrowserLeaseTable {
  /** Tenant owning both the lease and its run. */
  organizationId: string
  /** Browser-executed run under exclusive server ownership. */
  flowRunId: string
  /** Authenticated user allowed to renew and exercise the lease. */
  userId: string
  /** Opaque tab-scoped executor identity; never a credential. */
  executorId: string
  /** Monotonic ownership generation used to reject stale browser mutations. */
  fenceToken: import('kysely').Generated<number>
  /** Instant after which another browser executor may take over. */
  leaseExpiresAt: Timestamp
  /** Database-authored instant of the latest successful heartbeat. */
  heartbeatAt: Timestamp
  /** First ownership record creation instant. */
  createdAt: GeneratedTimestamp
  /** Most recent acquisition or heartbeat instant. */
  updatedAt: GeneratedTimestamp
}
