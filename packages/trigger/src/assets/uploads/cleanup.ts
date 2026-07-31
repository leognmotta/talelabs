/** Durable cleanup of expired direct-upload reservations and private objects. */

import {
  claimExpiredAssetUploadIntents,
  db,
  deferExpiredAssetUploadCleanup,
  markExpiredAssetUploadObjectDeleted,
} from '@talelabs/db'
import {
  deleteObject,
  getAssetBucket,
} from '@talelabs/storage'

const ASSET_UPLOAD_CLEANUP_PAGE_SIZE = 200
const ASSET_UPLOAD_CLEANUP_CONCURRENCY = 8

function safeErrorName(error: unknown) {
  return error instanceof Error ? error.name : 'UnknownError'
}

function cleanupFailureCode(error: unknown) {
  const candidate = error instanceof Error
    && 'code' in error
    && typeof error.code === 'string'
    ? error.code
    : null
  return candidate && /^[a-z][a-z0-9_]{0,127}$/.test(candidate)
    ? candidate
    : 'asset_upload_cleanup_failed'
}

async function cleanupExpiredAssetUpload(
  candidate: Awaited<
    ReturnType<typeof claimExpiredAssetUploadIntents>
  >[number],
) {
  try {
    await deleteObject({
      bucket: getAssetBucket('private'),
      key: candidate.objectKey,
    })
    await markExpiredAssetUploadObjectDeleted({
      id: candidate.id,
      organizationId: candidate.organizationId,
    }, db)
    return 'deleted' as const
  }
  catch (error) {
    await deferExpiredAssetUploadCleanup({
      cleanupAttemptCount: candidate.cleanupAttemptCount,
      errorCode: cleanupFailureCode(error),
      id: candidate.id,
      organizationId: candidate.organizationId,
    }, db).catch((deferError) => {
      console.error('Expired Asset upload retry scheduling failed.', {
        errorName: safeErrorName(deferError),
        uploadIntentId: candidate.id,
      })
    })
    console.error('Expired Asset upload cleanup will retry.', {
      errorName: safeErrorName(error),
      uploadIntentId: candidate.id,
    })
    return 'failed' as const
  }
}

/**
 * Releases a bounded page of expired upload holds and deletes every associated
 * private object idempotently with bounded object-storage concurrency.
 */
export async function cleanupExpiredAssetUploads() {
  const candidates = await claimExpiredAssetUploadIntents({
    limit: ASSET_UPLOAD_CLEANUP_PAGE_SIZE,
  }, db)
  let deleted = 0
  let failed = 0

  for (
    let index = 0;
    index < candidates.length;
    index += ASSET_UPLOAD_CLEANUP_CONCURRENCY
  ) {
    const batch = candidates.slice(
      index,
      index + ASSET_UPLOAD_CLEANUP_CONCURRENCY,
    )
    const results = await Promise.all(batch.map(cleanupExpiredAssetUpload))
    deleted += results.filter(result => result === 'deleted').length
    failed += results.filter(result => result === 'failed').length
  }

  return {
    claimed: candidates.length,
    deleted,
    failed,
  }
}
