/** Durable direct-upload intent contracts for quota reservation and cleanup. */

import type { Generated } from 'kysely'

import type { BillingBigIntColumn } from './billing-schema.js'
import type {
  GeneratedTimestamp,
  NullableTimestamp,
  Timestamp,
} from './column-types.js'

/** Durable lifecycle of one quota-backed direct-upload grant. */
export type AssetUploadIntentStatus
  = | 'canceled'
    | 'expired'
    | 'pending'
    | 'registered'

/** One signed direct-upload grant and its exact storage reservation. */
export interface AssetUploadIntentTable {
  /** Opaque grant identity embedded in the signed client token. */
  id: string
  /** Tenant that owns the reservation and eventual Asset. */
  organizationId: string
  /** Authenticated user allowed to register this upload. */
  userId: string
  /** Exact create-only private object key authorized by the signed URL. */
  objectKey: string
  /** Original filename captured when the grant was admitted. */
  filename: string
  /** Exact media type signed into the object PUT. */
  mimeType: string
  /** Whole bytes reserved against the organization storage entitlement. */
  sizeBytes: BillingBigIntColumn
  /** Base64 MD5 digest signed into the object PUT and registration token. */
  checksumMd5: string
  /** Current durable grant lifecycle. */
  status: Generated<AssetUploadIntentStatus>
  /** Exclusive registration boundary shared with the signed token. */
  expiresAt: Timestamp
  /** Canonical Asset created from this grant, only after registration. */
  assetId: string | null
  /** Instant when reserved bytes were converted or released exactly once. */
  reservationReleasedAt: NullableTimestamp
  /** Instant when the canonical Asset registration committed. */
  registeredAt: NullableTimestamp
  /** Instant when an abandoned object was confirmed deleted or absent. */
  objectDeletedAt: NullableTimestamp
  /** Number of durable cleanup claims, including claims recovered after crashes. */
  cleanupAttemptCount: Generated<number>
  /** Most recent instant this intent was leased for cleanup. */
  cleanupAttemptedAt: NullableTimestamp
  /** Stable non-secret classification from the most recent cleanup failure. */
  cleanupLastErrorCode: string | null
  /** Most recent instant object deletion or accounting settlement failed. */
  cleanupLastFailedAt: NullableTimestamp
  /** Next eligibility instant, or the active cleanup lease boundary. */
  cleanupNextAt: NullableTimestamp
  /** Initial quota-reservation instant. */
  createdAt: GeneratedTimestamp
  /** Latest lifecycle transition instant. */
  updatedAt: GeneratedTimestamp
}
