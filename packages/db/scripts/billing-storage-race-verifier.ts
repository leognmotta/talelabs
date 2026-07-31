/** Deterministic disposable-database checks for storage-accounting races. */

import type { Kysely } from 'kysely'
import type { Database } from '../src/schema.js'

import { getBillingPlan } from '@talelabs/billing'

import {
  invariant,
  seedVerifierRun,
} from './billing-verifier-support.js'

const organizationId = 'billing-org-zz-storage-races'
const uploadOrganizationId = 'billing-org-zz-upload-intents'

/**
 * Verifies stale upload destinations and both purge/ingestion linearizations.
 */
export async function verifyBillingStorageRaces(
  database: Kysely<Database>,
  accounting: typeof import('../src/index.js'),
  catalogRevision: string,
) {
  const assetLocation = await import(
    '../../../apps/api/src/data/asset-location.data.js',
  )

  await database.insertInto('projects')
    .values({
      id: 'storage-race-project',
      name: 'Storage race project',
      organizationId,
    })
    .execute()
  await database.insertInto('folders')
    .values({
      id: 'storage-race-folder',
      name: 'Storage race folder',
      organizationId,
      parentId: null,
      projectId: 'storage-race-project',
    })
    .execute()
  const staleFolder = await database.selectFrom('folders')
    .select(['id', 'projectId'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', 'storage-race-folder')
    .executeTakeFirstOrThrow()
  await database.deleteFrom('folders')
    .where('organizationId', '=', organizationId)
    .where('id', '=', staleFolder.id)
    .execute()
  const uploadUsageBefore = await database
    .selectFrom('organizationStorageUsage')
    .select('usedBytes')
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  const upload = await assetLocation.insertUploadedAsset({
    createdBy: 'billing-verifier-user',
    checksumMd5: 'billing-verifier-legacy-md5',
    expiresAt: new Date(Date.now() + 60_000),
    folderId: staleFolder.id,
    grantFilename: 'Stale destination upload',
    grantVersion: 1,
    id: 'storage-race-upload',
    mimeType: 'image/png',
    name: 'Stale destination upload',
    organizationId,
    projectId: staleFolder.projectId,
    sizeBytes: 7,
    storageKey: 'billing-verifier/storage-race-upload',
    type: 'image',
    uploadId: 'storage-race-upload',
  }, database)
  const uploadUsageAfter = await database
    .selectFrom('organizationStorageUsage')
    .select('usedBytes')
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    upload.status === 'not_found'
    && uploadUsageAfter.usedBytes === uploadUsageBefore.usedBytes,
    'upload_destination_race_leaked_storage',
  )

  const storageLimitBytes = getBillingPlan('free').storageBytes
  await database.updateTable('organizationStorageUsage')
    .set({ usedBytes: storageLimitBytes - 10 })
    .where('organizationId', '=', uploadOrganizationId)
    .execute()
  const concurrentExpiry = new Date(Date.now() + 60_000)
  const concurrentReservations = await Promise.allSettled([
    accounting.reserveAssetUploadIntent({
      catalogRevision,
      checksumMd5: 'upload-concurrent-a-md5',
      expiresAt: concurrentExpiry,
      filename: 'Concurrent A',
      id: 'upload-concurrent-a',
      mimeType: 'image/png',
      objectKey: 'billing-verifier/upload-concurrent-a',
      organizationId: uploadOrganizationId,
      sizeBytes: 6,
      userId: 'billing-verifier-user',
    }, database),
    accounting.reserveAssetUploadIntent({
      catalogRevision,
      checksumMd5: 'upload-concurrent-b-md5',
      expiresAt: concurrentExpiry,
      filename: 'Concurrent B',
      id: 'upload-concurrent-b',
      mimeType: 'image/png',
      objectKey: 'billing-verifier/upload-concurrent-b',
      organizationId: uploadOrganizationId,
      sizeBytes: 6,
      userId: 'billing-verifier-user',
    }, database),
  ])
  invariant(
    concurrentReservations.filter(result => result.status === 'fulfilled')
      .length === 1,
    'concurrent_upload_grants_exceeded_storage',
  )
  const admittedUploadIndex = concurrentReservations.findIndex(
    result => result.status === 'fulfilled',
  )
  const admittedUploadId = admittedUploadIndex === 0
    ? 'upload-concurrent-a'
    : 'upload-concurrent-b'
  await accounting.cancelUnexposedAssetUploadIntent({
    id: admittedUploadId,
    organizationId: uploadOrganizationId,
  }, database)
  await database.updateTable('organizationStorageUsage')
    .set({ usedBytes: 0 })
    .where('organizationId', '=', uploadOrganizationId)
    .execute()

  const registeredExpiry = new Date(Date.now() + 60_000)
  await accounting.reserveAssetUploadIntent({
    catalogRevision,
    checksumMd5: 'upload-registered-md5',
    expiresAt: registeredExpiry,
    filename: 'Registered original',
    id: 'upload-registered',
    mimeType: 'image/png',
    objectKey: 'billing-verifier/upload-registered',
    organizationId: uploadOrganizationId,
    sizeBytes: 8,
    userId: 'billing-verifier-user',
  }, database)
  const registered = await assetLocation.insertUploadedAsset({
    checksumMd5: 'upload-registered-md5',
    createdBy: 'billing-verifier-user',
    expiresAt: registeredExpiry,
    folderId: null,
    grantFilename: 'Registered original',
    grantVersion: 2,
    id: 'upload-registered-asset',
    mimeType: 'image/png',
    name: 'Renamed during registration',
    organizationId: uploadOrganizationId,
    projectId: null,
    sizeBytes: 8,
    storageKey: 'billing-verifier/upload-registered',
    type: 'image',
    uploadId: 'upload-registered',
  }, database)
  const registeredReplay = await assetLocation.insertUploadedAsset({
    checksumMd5: 'upload-registered-md5',
    createdBy: 'billing-verifier-user',
    expiresAt: registeredExpiry,
    folderId: null,
    grantFilename: 'Registered original',
    grantVersion: 2,
    id: 'upload-registered-replay',
    mimeType: 'image/png',
    name: 'Ignored replay name',
    organizationId: uploadOrganizationId,
    projectId: null,
    sizeBytes: 8,
    storageKey: 'billing-verifier/upload-registered',
    type: 'image',
    uploadId: 'upload-registered',
  }, database)
  const registeredUsage = await database
    .selectFrom('organizationStorageUsage')
    .select(['reservedBytes', 'usedBytes'])
    .where('organizationId', '=', uploadOrganizationId)
    .executeTakeFirstOrThrow()
  invariant(
    registered.status === 'created'
    && registeredReplay.status === 'replayed'
    && registeredReplay.asset.id === registered.asset.id
    && registeredUsage.reservedBytes === '0'
    && registeredUsage.usedBytes === '8',
    'upload_registration_reservation_settlement',
  )

  const abandonedExpiry = new Date(Date.now() + 60_000)
  await accounting.reserveAssetUploadIntent({
    catalogRevision,
    checksumMd5: 'upload-abandoned-md5',
    expiresAt: abandonedExpiry,
    filename: 'Abandoned',
    id: 'upload-abandoned',
    mimeType: 'image/png',
    objectKey: 'billing-verifier/upload-abandoned',
    organizationId: uploadOrganizationId,
    sizeBytes: 5,
    userId: 'billing-verifier-user',
  }, database)
  const laterAbandonedExpiry = new Date(abandonedExpiry.getTime() + 1_000)
  await accounting.reserveAssetUploadIntent({
    catalogRevision,
    checksumMd5: 'upload-later-abandoned-md5',
    expiresAt: laterAbandonedExpiry,
    filename: 'Later abandoned',
    id: 'upload-later-abandoned',
    mimeType: 'image/png',
    objectKey: 'billing-verifier/upload-later-abandoned',
    organizationId: uploadOrganizationId,
    sizeBytes: 4,
    userId: 'billing-verifier-user',
  }, database)
  const cleanupNow = new Date(laterAbandonedExpiry.getTime() + 1)
  const cleanup = await accounting.claimExpiredAssetUploadIntents({
    limit: 1,
    now: cleanupNow,
  }, database)
  invariant(
    cleanup.length === 1
    && cleanup[0]?.cleanupAttemptCount === 1
    && cleanup[0].id === 'upload-abandoned',
    'abandoned_upload_cleanup_claim',
  )
  const deferred = await accounting.deferExpiredAssetUploadCleanup({
    cleanupAttemptCount: cleanup[0].cleanupAttemptCount,
    errorCode: 'object_delete_failed',
    id: cleanup[0].id,
    organizationId: cleanup[0].organizationId,
  }, database, cleanupNow)
  invariant(
    deferred.state === 'deferred'
    && deferred.cleanupNextAt > cleanupNow,
    'abandoned_upload_cleanup_backoff',
  )
  const laterCleanup = await accounting.claimExpiredAssetUploadIntents({
    limit: 1,
    now: new Date(cleanupNow.getTime() + 1),
  }, database)
  invariant(
    laterCleanup.length === 1
    && laterCleanup[0]?.id === 'upload-later-abandoned',
    'failed_upload_cleanup_starved_later_intent',
  )
  const expiredHold = await database
    .selectFrom('organizationStorageUsage')
    .select('reservedBytes')
    .where('organizationId', '=', uploadOrganizationId)
    .executeTakeFirstOrThrow()
  invariant(
    expiredHold.reservedBytes === '9',
    'expired_upload_released_before_object_deletion',
  )
  await accounting.markExpiredAssetUploadObjectDeleted({
    id: 'upload-later-abandoned',
    organizationId: uploadOrganizationId,
  }, database)
  const prematureRetry = await accounting.claimExpiredAssetUploadIntents({
    limit: 1,
    now: new Date(deferred.cleanupNextAt.getTime() - 1),
  }, database)
  invariant(
    prematureRetry.length === 0,
    'failed_upload_cleanup_retried_before_backoff',
  )
  const retriedCleanup = await accounting.claimExpiredAssetUploadIntents({
    limit: 1,
    now: deferred.cleanupNextAt,
  }, database)
  invariant(
    retriedCleanup.length === 1
    && retriedCleanup[0]?.cleanupAttemptCount === 2
    && retriedCleanup[0].id === 'upload-abandoned',
    'failed_upload_cleanup_not_retried',
  )
  await accounting.markExpiredAssetUploadObjectDeleted({
    id: retriedCleanup[0].id,
    organizationId: retriedCleanup[0].organizationId,
  }, database)
  const abandoned = await database.selectFrom('assetUploadIntents')
    .select([
      'cleanupAttemptCount',
      'cleanupLastErrorCode',
      'cleanupNextAt',
      'objectDeletedAt',
      'status',
    ])
    .where('organizationId', '=', uploadOrganizationId)
    .where('id', '=', 'upload-abandoned')
    .executeTakeFirstOrThrow()
  const cleanupUsage = await database
    .selectFrom('organizationStorageUsage')
    .select(['reservedBytes', 'usedBytes'])
    .where('organizationId', '=', uploadOrganizationId)
    .executeTakeFirstOrThrow()
  invariant(
    abandoned.status === 'expired'
    && abandoned.objectDeletedAt !== null
    && abandoned.cleanupAttemptCount === 2
    && abandoned.cleanupLastErrorCode === 'object_delete_failed'
    && abandoned.cleanupNextAt === null
    && cleanupUsage.reservedBytes === '0'
    && cleanupUsage.usedBytes === '8',
    'abandoned_upload_reservation_leaked',
  )

  const run = await seedVerifierRun(
    database,
    organizationId,
    'storage-purge-race',
    2,
    'browser',
  )
  await accounting.reserveRunOutputStorage({
    catalogRevision,
    jobs: run.jobIds.map(generationJobId => ({
      generationJobId,
      storageReservedBytes: 5,
    })),
    organizationId,
    runId: run.runId,
    storageLimitBytes: 100,
  }, database)
  await database.insertInto('assets')
    .values([
      {
        generationJobId: run.jobIds[0]!,
        id: 'storage-race-purge-first',
        mimeType: 'image/png',
        name: 'Purge first',
        organizationId,
        outputIndex: 0,
        processingState: 'processing',
        source: 'generation',
        storageKey: 'billing-verifier/storage-race-purge-first',
        type: 'image',
      },
      {
        generationJobId: run.jobIds[1]!,
        id: 'storage-race-ingest-first',
        mimeType: 'image/png',
        name: 'Ingest first',
        organizationId,
        outputIndex: 0,
        processingState: 'processing',
        source: 'generation',
        storageKey: 'billing-verifier/storage-race-ingest-first',
        type: 'image',
      },
    ])
    .execute()

  const purgeRequestedAt = new Date()
  await database.updateTable('assets')
    .set({
      deletedAt: purgeRequestedAt,
      purgeRequestedAt,
    })
    .where('organizationId', '=', organizationId)
    .where('id', '=', 'storage-race-purge-first')
    .execute()
  await accounting.releasePurgedAssetStorage({
    assetId: 'storage-race-purge-first',
    organizationId,
  }, database)
  const purgeFirstCommit = await accounting.commitGeneratedAssetStorage({
    assetId: 'storage-race-purge-first',
    organizationId,
    outputCount: 1,
    sizeBytes: 4,
    storageLimitBytes: 100,
  }, database)
  const purgeFirstAsset = await database.selectFrom('assets')
    .select(['purgedAt', 'sizeBytes'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', 'storage-race-purge-first')
    .executeTakeFirstOrThrow()
  const purgeFirstUsage = await database
    .selectFrom('organizationStorageUsage')
    .select('usedBytes')
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    purgeFirstCommit.state === 'purge_won'
    && purgeFirstAsset.purgedAt !== null
    && purgeFirstAsset.sizeBytes === null
    && purgeFirstUsage.usedBytes === '0',
    'purge_first_ingestion_leaked_storage',
  )

  const ingestFirstCommit = await accounting.commitGeneratedAssetStorage({
    assetId: 'storage-race-ingest-first',
    organizationId,
    outputCount: 1,
    sizeBytes: 4,
    storageLimitBytes: 100,
  }, database)
  await database.updateTable('assets')
    .set({
      deletedAt: purgeRequestedAt,
      purgeRequestedAt,
    })
    .where('organizationId', '=', organizationId)
    .where('id', '=', 'storage-race-ingest-first')
    .execute()
  const ingestFirstPurge = await accounting.releasePurgedAssetStorage({
    assetId: 'storage-race-ingest-first',
    organizationId,
  }, database)
  const finalUsage = await database.selectFrom('organizationStorageUsage')
    .select('usedBytes')
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  invariant(
    ingestFirstCommit.state === 'committed'
    && ingestFirstPurge.releasedBytes === 4
    && finalUsage.usedBytes === '0',
    'ingestion_first_purge_leaked_storage',
  )
}
