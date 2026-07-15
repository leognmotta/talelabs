import { createHash } from 'node:crypto'

import { db } from '@talelabs/db'
import { readFlowRunJobRequestPayload } from '@talelabs/flows'
import {
  buildAssetStorageKey,
  CURRENT_GENERATED_OUTPUT_VISIBILITY,
  deleteObject,
  getAssetBucket,
} from '@talelabs/storage'

const GENERATED_OUTPUT_CLEANUP_CONCURRENCY = 10

/**
 * Derives retry-stable identity and storage for a generated media output. The
 * visibility is trusted code policy until billing can choose by funding source.
 */
export function getGeneratedOutputStorageLocation(input: {
  generationJobId: string
  organizationId: string
  outputIndex: number
}) {
  if (!Number.isSafeInteger(input.outputIndex) || input.outputIndex < 0)
    throw new Error('outputIndex must be a non-negative integer.')

  const digest = createHash('sha256')
    .update(`${input.generationJobId}:${input.outputIndex}`)
    .digest('hex')
  const assetId = `a${digest.slice(0, 23)}`
  const visibility = CURRENT_GENERATED_OUTPUT_VISIBILITY
  return {
    assetId,
    bucket: getAssetBucket(visibility),
    key: buildAssetStorageKey({
      assetId,
      organizationId: input.organizationId,
      visibility,
    }),
    visibility,
  }
}

/**
 * Deletes deterministic media objects only when no canonical Asset owns the
 * exact job/output slot. Terminal callers may safely replay this cleanup.
 */
export async function cleanupUncommittedGeneratedOutputObjects(input: {
  generationJobId: string
  organizationId: string
}) {
  const job = await db.selectFrom('generationJobs')
    .select(['mediaType', 'requestHash', 'requestPayload', 'status'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.generationJobId)
    .executeTakeFirst()
  if (
    !job
    || job.mediaType === 'text'
    || !['canceled', 'failed'].includes(job.status)
  ) {
    return 0
  }

  const request = readFlowRunJobRequestPayload({
    requestHash: job.requestHash,
    requestPayload: job.requestPayload,
  })
  let deletedCount = 0
  for (let outputIndex = 0; outputIndex < request.outputCount; outputIndex += 1) {
    const storage = getGeneratedOutputStorageLocation({
      generationJobId: input.generationJobId,
      organizationId: input.organizationId,
      outputIndex,
    })
    const committedAsset = await db.selectFrom('assets')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('generationJobId', '=', input.generationJobId)
      .where('outputIndex', '=', outputIndex)
      .where('storageKey', '=', storage.key)
      .executeTakeFirst()
    if (committedAsset)
      continue

    await deleteObject({ bucket: storage.bucket, key: storage.key })
    deletedCount += 1
  }
  return deletedCount
}

/** Bounded terminal-run repair for abnormal cancellation and parent failure. */
export async function cleanupUncommittedGeneratedOutputObjectsForRun(input: {
  flowRunId: string
  organizationId: string
}) {
  const jobs = await db.selectFrom('generationJobs')
    .select('id')
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where('mediaType', 'in', ['audio', 'image', 'video'])
    .where('status', 'in', ['canceled', 'failed'])
    .orderBy('id')
    .execute()
  let deletedCount = 0
  for (let index = 0; index < jobs.length; index += GENERATED_OUTPUT_CLEANUP_CONCURRENCY) {
    const batch = jobs.slice(index, index + GENERATED_OUTPUT_CLEANUP_CONCURRENCY)
    const counts = await Promise.all(batch.map(job => (
      cleanupUncommittedGeneratedOutputObjects({
        generationJobId: job.id,
        organizationId: input.organizationId,
      })
    )))
    deletedCount += counts.reduce((total, count) => total + count, 0)
  }
  return deletedCount
}
