/**
 * Transactional quota reservation, registration settlement, and cleanup for
 * direct Asset uploads.
 */

import type { Transaction } from 'kysely'

import type { Database, DatabaseExecutor } from './index.js'

import { getBillingPlan } from '@talelabs/billing'
import { sql } from 'kysely'

import { reconcileExpiredPaidEntitlement } from './billing-entitlements.js'
import {
  BillingAccountingError,
  ensureOrganizationBillingState,
} from './billing-state.js'
import { withDatabaseTransaction } from './index.js'

const ASSET_UPLOAD_CLEANUP_LEASE_MS = 10 * 60 * 1_000
const ASSET_UPLOAD_CLEANUP_RETRY_DELAYS_MS = [
  60 * 1_000,
  5 * 60 * 1_000,
  15 * 60 * 1_000,
  60 * 60 * 1_000,
  6 * 60 * 60 * 1_000,
] as const

/** Immutable facts shared by the database intent and signed upload token. */
export interface AssetUploadIntentFacts {
  /** Base64 MD5 digest signed into the create-only PUT. */
  checksumMd5: string
  /** Exclusive registration boundary for the upload. */
  expiresAt: Date
  /** Original filename captured for default Asset naming. */
  filename: string
  /** Opaque durable upload-grant identity. */
  id: string
  /** Exact media type signed into the create-only PUT. */
  mimeType: string
  /** Exact tenant-prefixed private object key. */
  objectKey: string
  /** Tenant receiving the future Asset. */
  organizationId: string
  /** Whole bytes reserved before the signed URL is returned. */
  sizeBytes: number
  /** Authenticated user allowed to register the future Asset. */
  userId: string
}

function assertPositiveSafeBytes(sizeBytes: number) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1)
    throw new RangeError('Asset upload size must be positive whole bytes.')
}

function intentFactsMatch(
  intent: {
    checksumMd5: string
    expiresAt: Date
    filename: string
    id: string
    mimeType: string
    objectKey: string
    organizationId: string
    sizeBytes: string
    userId: string
  },
  input: AssetUploadIntentFacts,
) {
  return intent.id === input.id
    && intent.organizationId === input.organizationId
    && intent.userId === input.userId
    && intent.objectKey === input.objectKey
    && intent.filename === input.filename
    && intent.mimeType === input.mimeType
    && intent.sizeBytes === String(input.sizeBytes)
    && intent.checksumMd5 === input.checksumMd5
    && intent.expiresAt.getTime() === input.expiresAt.getTime()
}

/**
 * Reserves declared upload bytes atomically before a signed object URL may be
 * returned to the client.
 */
export async function reserveAssetUploadIntent(
  input: AssetUploadIntentFacts & {
    /** Current catalog revision used for lazy billing-state initialization. */
    catalogRevision: string
  },
  database: DatabaseExecutor,
) {
  assertPositiveSafeBytes(input.sizeBytes)
  if (input.expiresAt.getTime() <= Date.now())
    throw new RangeError('Asset upload expiry must be in the future.')

  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(input, trx)
    await reconcileExpiredPaidEntitlement(input.organizationId, trx)
    const account = await trx.selectFrom('organizationBillingAccounts')
      .select('currentPlanCode')
      .where('organizationId', '=', input.organizationId)
      .executeTakeFirstOrThrow()
    const storageLimitBytes
      = getBillingPlan(account.currentPlanCode).storageBytes
    const usage = await trx.selectFrom('organizationStorageUsage')
      .select(['reservedBytes', 'usedBytes'])
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const next = BigInt(usage.usedBytes)
      + BigInt(usage.reservedBytes)
      + BigInt(input.sizeBytes)
    if (next > BigInt(storageLimitBytes)) {
      throw new BillingAccountingError(
        'storage_limit_exceeded',
        'The organization storage limit would be exceeded.',
      )
    }
    await trx.insertInto('assetUploadIntents')
      .values({
        checksumMd5: input.checksumMd5,
        expiresAt: input.expiresAt,
        filename: input.filename,
        id: input.id,
        mimeType: input.mimeType,
        objectKey: input.objectKey,
        organizationId: input.organizationId,
        sizeBytes: input.sizeBytes,
        userId: input.userId,
      })
      .execute()
    await trx.updateTable('organizationStorageUsage')
      .set(eb => ({
        reservedBytes: eb('reservedBytes', '+', input.sizeBytes.toString()),
        updatedAt: new Date(),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    return { reservedBytes: input.sizeBytes }
  })
}

/**
 * Releases a reservation when URL signing failed before the object capability
 * could be exposed to a client.
 */
export async function cancelUnexposedAssetUploadIntent(
  input: {
    /** Durable upload intent to cancel. */
    id: string
    /** Tenant owning the upload intent. */
    organizationId: string
  },
  database: DatabaseExecutor,
  now = new Date(),
) {
  return withDatabaseTransaction(database, async (trx) => {
    const intent = await trx.selectFrom('assetUploadIntents')
      .select(['sizeBytes', 'status'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (!intent || intent.status !== 'pending')
      return { releasedBytes: 0, replayed: true as const }
    const usage = await trx.selectFrom('organizationStorageUsage')
      .select('reservedBytes')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const bytes = BigInt(intent.sizeBytes)
    if (BigInt(usage.reservedBytes) < bytes)
      throw new Error('asset_upload_reserved_bytes_underflow')
    await trx.updateTable('organizationStorageUsage')
      .set(eb => ({
        reservedBytes: eb('reservedBytes', '-', intent.sizeBytes),
        updatedAt: now,
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    await trx.updateTable('assetUploadIntents')
      .set({
        objectDeletedAt: now,
        reservationReleasedAt: now,
        status: 'canceled',
        updatedAt: now,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .where('status', '=', 'pending')
      .executeTakeFirstOrThrow()
    return { releasedBytes: Number(bytes), replayed: false as const }
  })
}

/**
 * Locks and validates one upload intent inside the caller's Asset-registration
 * transaction.
 */
export async function lockAssetUploadIntentForRegistration(
  input: AssetUploadIntentFacts,
  trx: Transaction<Database>,
  now = new Date(),
) {
  assertPositiveSafeBytes(input.sizeBytes)
  const intent = await trx.selectFrom('assetUploadIntents')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.id)
    .forUpdate()
    .executeTakeFirst()
  if (!intent || !intentFactsMatch(intent, input))
    return { status: 'invalid' as const }
  if (intent.status === 'registered' && intent.assetId) {
    return {
      assetId: intent.assetId,
      status: 'registered' as const,
    }
  }
  if (intent.status !== 'pending' || intent.expiresAt <= now)
    return { status: 'invalid' as const }
  return { status: 'pending' as const }
}

/**
 * Converts one previously locked upload reservation to canonical used bytes
 * after its Asset row has been inserted in the same transaction.
 */
export async function commitAssetUploadIntentRegistration(
  input: {
    /** Canonical Asset created from the upload. */
    assetId: string
    /** Durable upload intent being settled. */
    id: string
    /** Tenant owning both the intent and Asset. */
    organizationId: string
  },
  trx: Transaction<Database>,
  now = new Date(),
) {
  const intent = await trx.selectFrom('assetUploadIntents')
    .select(['sizeBytes', 'status'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.id)
    .forUpdate()
    .executeTakeFirstOrThrow()
  if (intent.status !== 'pending')
    throw new Error('asset_upload_intent_not_pending')
  const usage = await trx.selectFrom('organizationStorageUsage')
    .select('reservedBytes')
    .where('organizationId', '=', input.organizationId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  const bytes = BigInt(intent.sizeBytes)
  if (BigInt(usage.reservedBytes) < bytes)
    throw new Error('asset_upload_reserved_bytes_underflow')
  await trx.updateTable('organizationStorageUsage')
    .set(eb => ({
      reservedBytes: eb('reservedBytes', '-', intent.sizeBytes),
      updatedAt: now,
      usedBytes: eb('usedBytes', '+', intent.sizeBytes),
      version: eb('version', '+', '1'),
    }))
    .where('organizationId', '=', input.organizationId)
    .execute()
  await trx.updateTable('assetUploadIntents')
    .set({
      assetId: input.assetId,
      registeredAt: now,
      reservationReleasedAt: now,
      status: 'registered',
      updatedAt: now,
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.id)
    .where('status', '=', 'pending')
    .executeTakeFirstOrThrow()
}

/** One expired upload whose private object still requires deletion. */
export interface ExpiredAssetUploadCleanupCandidate {
  /** Durable claim revision used to reject a stale failure report. */
  cleanupAttemptCount: number
  /** Durable upload intent being cleaned. */
  id: string
  /** Exact private object key to delete idempotently. */
  objectKey: string
  /** Tenant owning the intent and object. */
  organizationId: string
}

/**
 * Claims a bounded page of expired uploads while retaining each storage hold
 * until its private object is confirmed deleted.
 */
export async function claimExpiredAssetUploadIntents(
  input: {
    /** Maximum candidates returned by this bounded sweep. */
    limit: number
    /** Reconciliation instant used for deterministic verification. */
    now?: Date
  },
  database: DatabaseExecutor,
) {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 500)
    throw new RangeError('Asset upload cleanup limit must be from 1 to 500.')
  const now = input.now ?? new Date()
  const leaseExpiresAt = new Date(
    now.getTime() + ASSET_UPLOAD_CLEANUP_LEASE_MS,
  )
  const cleanupEligibilityAt = sql<Date>`
    coalesce("cleanupNextAt", "expiresAt")
  `
  return withDatabaseTransaction(database, async (trx) => {
    const intents = await trx.selectFrom('assetUploadIntents')
      .select([
        'cleanupAttemptCount',
        'id',
        'objectKey',
        'organizationId',
      ])
      .where('objectDeletedAt', 'is', null)
      // Keep the literal predicate aligned with migration 044 so PostgreSQL
      // can prove this parameterized query is covered by the partial index.
      .where(sql<boolean>`"status" in ('pending', 'expired')`)
      .where(cleanupEligibilityAt, '<=', now)
      .orderBy(cleanupEligibilityAt)
      .orderBy('id')
      .limit(input.limit)
      .forUpdate()
      .skipLocked()
      .execute()

    const candidates: ExpiredAssetUploadCleanupCandidate[] = []
    for (const intent of intents) {
      const cleanupAttemptCount = intent.cleanupAttemptCount + 1
      await trx.updateTable('assetUploadIntents')
        .set({
          cleanupAttemptCount,
          cleanupAttemptedAt: now,
          cleanupNextAt: leaseExpiresAt,
          status: 'expired',
          updatedAt: now,
        })
        .where('organizationId', '=', intent.organizationId)
        .where('id', '=', intent.id)
        .where('objectDeletedAt', 'is', null)
        .executeTakeFirstOrThrow()
      candidates.push({
        cleanupAttemptCount,
        id: intent.id,
        objectKey: intent.objectKey,
        organizationId: intent.organizationId,
      })
    }
    return candidates
  })
}

function cleanupRetryAt(attemptCount: number, now: Date) {
  const delay = ASSET_UPLOAD_CLEANUP_RETRY_DELAYS_MS[
    Math.min(
      attemptCount - 1,
      ASSET_UPLOAD_CLEANUP_RETRY_DELAYS_MS.length - 1,
    )
  ]!
  return new Date(now.getTime() + delay)
}

/** Defers one failed cleanup claim with durable bounded staged backoff. */
export async function deferExpiredAssetUploadCleanup(
  input: {
    /** Claim revision returned by the cleanup selector. */
    cleanupAttemptCount: number
    /** Stable non-secret cleanup failure classification. */
    errorCode: string
    /** Durable expired upload intent. */
    id: string
    /** Tenant owning the expired upload intent. */
    organizationId: string
  },
  database: DatabaseExecutor,
  now = new Date(),
) {
  if (!Number.isSafeInteger(input.cleanupAttemptCount) || input.cleanupAttemptCount < 1)
    throw new RangeError('Asset upload cleanup attempt must be positive.')
  if (!/^[a-z][a-z0-9_]{0,127}$/.test(input.errorCode))
    throw new RangeError('Asset upload cleanup error code is invalid.')

  return withDatabaseTransaction(database, async (trx) => {
    const intent = await trx.selectFrom('assetUploadIntents')
      .select(['cleanupAttemptCount', 'objectDeletedAt', 'status'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (
      !intent
      || intent.status !== 'expired'
      || intent.objectDeletedAt
    ) {
      return { state: 'not_pending' as const }
    }
    if (intent.cleanupAttemptCount !== input.cleanupAttemptCount)
      return { state: 'stale_claim' as const }

    const cleanupNextAt = cleanupRetryAt(input.cleanupAttemptCount, now)
    await trx.updateTable('assetUploadIntents')
      .set({
        cleanupLastErrorCode: input.errorCode,
        cleanupLastFailedAt: now,
        cleanupNextAt,
        updatedAt: now,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .where('status', '=', 'expired')
      .where('objectDeletedAt', 'is', null)
      .where('cleanupAttemptCount', '=', input.cleanupAttemptCount)
      .executeTakeFirstOrThrow()
    return {
      cleanupNextAt,
      state: 'deferred' as const,
    }
  })
}

/** Records object deletion and releases its expired upload hold exactly once. */
export async function markExpiredAssetUploadObjectDeleted(
  input: {
    /** Durable expired upload intent. */
    id: string
    /** Tenant owning the expired upload intent. */
    organizationId: string
  },
  database: DatabaseExecutor,
  now = new Date(),
) {
  return withDatabaseTransaction(database, async (trx) => {
    const intent = await trx.selectFrom('assetUploadIntents')
      .select(['objectDeletedAt', 'sizeBytes', 'status'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (
      !intent
      || intent.status !== 'expired'
      || intent.objectDeletedAt
    ) {
      return { releasedBytes: 0, replayed: true as const }
    }
    const usage = await trx.selectFrom('organizationStorageUsage')
      .select('reservedBytes')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const bytes = BigInt(intent.sizeBytes)
    if (BigInt(usage.reservedBytes) < bytes)
      throw new Error('asset_upload_reserved_bytes_underflow')
    await trx.updateTable('organizationStorageUsage')
      .set(eb => ({
        reservedBytes: eb('reservedBytes', '-', intent.sizeBytes),
        updatedAt: now,
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    await trx.updateTable('assetUploadIntents')
      .set({
        cleanupNextAt: null,
        objectDeletedAt: now,
        reservationReleasedAt: now,
        updatedAt: now,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .where('status', '=', 'expired')
      .where('objectDeletedAt', 'is', null)
      .executeTakeFirstOrThrow()
    return { releasedBytes: Number(bytes), replayed: false as const }
  })
}
