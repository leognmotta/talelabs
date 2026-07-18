/** Media-output storage, canonical Asset creation, and cleanup coordination. */

import type { NormalizedGenerationOutput } from '@talelabs/flows'
import type { AssetVisibility } from '@talelabs/storage'
import type {
  FinalizableGenerationJob,
  GenerationOutputCommitGuard,
} from './finalizer.js'

import { db } from '@talelabs/db'
import {
  copyObject,
  deleteObject,
  getAssetBucket,
  putObject,
} from '@talelabs/storage'

import { getGeneratedOutputStorageLocation } from '../../../assets/outputs/generated-storage.js'
import { toSafeRunFailure } from '../../../shared/failures/run-failure.js'
import { logRunEngine } from '../../observability/logging.js'
import {
  ingestCommittedAssetOutput,
  persistAssetOutputIfJobRunning,
} from './asset-persistence.js'

async function deleteGeneratedObjectIfUncommitted(input: {
  jobId: string
  key: string
  organizationId: string
  outputIndex: number
  visibility: AssetVisibility
}) {
  const committedAsset = await db.selectFrom('assets')
    .select('id')
    .where('organizationId', '=', input.organizationId)
    .where('generationJobId', '=', input.jobId)
    .where('outputIndex', '=', input.outputIndex)
    .where('storageKey', '=', input.key)
    .executeTakeFirst()
  if (committedAsset)
    return
  try {
    await deleteObject({ bucket: getAssetBucket(input.visibility), key: input.key })
  }
  catch (error) {
    const failure = toSafeRunFailure(error)
    logRunEngine('error', 'generation_job.uncommitted_object_delete_failed', {
      generationJobId: input.jobId,
      internalError: failure.internal,
      organizationId: input.organizationId,
      outputIndex: input.outputIndex,
    })
    throw error
  }
}

/** Materializes one normalized media output and completes canonical Asset ingestion. */
export async function finalizeMediaOutput(
  job: FinalizableGenerationJob & { mediaType: 'audio' | 'image' | 'video' },
  output: NormalizedGenerationOutput,
  assetIngestion: 'api' | 'task' = 'task',
  commitGuard?: GenerationOutputCommitGuard,
) {
  if (
    output.payload.delivery !== 'bytes'
    && output.payload.delivery !== 'storage'
  ) {
    throw new Error('generation_media_delivery_not_materialized')
  }
  const existingAsset = await db.selectFrom('assets')
    .select(['id', 'processingState'])
    .where('organizationId', '=', job.organizationId)
    .where('generationJobId', '=', job.id)
    .where('outputIndex', '=', output.outputIndex)
    .executeTakeFirst()
  const storage = getGeneratedOutputStorageLocation({
    generationJobId: job.id,
    organizationId: job.organizationId,
    outputIndex: output.outputIndex,
  })
  const assetId = existingAsset?.id ?? storage.assetId
  let wroteObject = false
  if (!existingAsset) {
    if (output.payload.delivery === 'storage') {
      if (
        output.payload.bucket !== storage.bucket
        || output.payload.key !== storage.key
      ) {
        await copyObject({
          bucket: output.payload.bucket,
          destinationBucket: storage.bucket,
          destinationKey: storage.key,
          sourceBucket: output.payload.bucket,
          sourceKey: output.payload.key,
        })
        wroteObject = true
      }
    }
    else {
      await putObject({
        body: output.payload.bytes,
        bucket: storage.bucket,
        contentType: output.payload.mimeType,
        key: storage.key,
      })
      wroteObject = true
    }
  }
  const persisted = await persistAssetOutputIfJobRunning({
    assetId,
    commitGuard,
    job,
    key: storage.key,
    metadata: output.metadata,
    mimeType: output.payload.mimeType,
    outputIndex: output.outputIndex,
    visibility: storage.visibility,
  }).catch(async (error) => {
    if (wroteObject) {
      await deleteGeneratedObjectIfUncommitted({
        jobId: job.id,
        key: storage.key,
        organizationId: job.organizationId,
        outputIndex: output.outputIndex,
        visibility: storage.visibility,
      })
    }
    throw error
  })
  if (!persisted.persisted) {
    if (wroteObject) {
      await deleteGeneratedObjectIfUncommitted({
        jobId: job.id,
        key: storage.key,
        organizationId: job.organizationId,
        outputIndex: output.outputIndex,
        visibility: storage.visibility,
      })
    }
    return false
  }
  await ingestCommittedAssetOutput({
    assetId: persisted.assetId,
    dispatch: assetIngestion,
    job,
    outputIndex: output.outputIndex,
  })
  return true
}
