import type { NormalizedGenerationOutput } from '@talelabs/flows'
import type { AssetVisibility } from '@talelabs/storage'

import { db } from '@talelabs/db'
import {
  copyObject,
  deleteObject,
  getAssetBucket,
  putObject,
} from '@talelabs/storage'
import { idempotencyKeys } from '@trigger.dev/sdk'

import { ensureFlowOutputFolder } from '../../flow-output-folders.js'
import { getGeneratedOutputStorageLocation } from '../../generated-output-storage.js'
import { toSafeRunFailure } from '../../run-failure.js'
import { assetIngestTask } from '../asset-processing.js'
import { aggregateJobState, claimRunningJob } from './generation-job-state.js'
import { logRunEngine } from './logging.js'

export interface FinalizableGenerationJob {
  createdBy: null | string
  flowId: null | string
  flowRunId: string
  id: string
  itemKey: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  model: string
  nodeId: string
  organizationId: string
}

async function persistTextOutputIfJobRunning(input: {
  job: FinalizableGenerationJob
  outputIndex: number
  text: string
}) {
  return db.transaction().execute(async (trx) => {
    const job = await trx.updateTable('generationJobs')
      .set({ status: 'running' })
      .where('organizationId', '=', input.job.organizationId)
      .where('id', '=', input.job.id)
      .where('flowRunId', '=', input.job.flowRunId)
      .where('status', '=', 'running')
      .returning('id')
      .executeTakeFirst()
    if (!job)
      return false
    await trx.insertInto('generationJobTextOutputs')
      .values({
        jobId: input.job.id,
        organizationId: input.job.organizationId,
        outputIndex: input.outputIndex,
        text: input.text,
      })
      .onConflict(conflict => conflict.columns(['jobId', 'outputIndex']).doNothing())
      .execute()
    return true
  })
}

async function persistAssetOutputIfJobRunning(input: {
  assetId: string
  job: FinalizableGenerationJob & { mediaType: 'audio' | 'image' | 'video' }
  key: string
  metadata?: Readonly<Record<string, boolean | number | string>>
  mimeType: string
  outputIndex: number
  visibility: AssetVisibility
}) {
  return db.transaction().execute(async (trx) => {
    const job = await trx.updateTable('generationJobs')
      .set({ status: 'running' })
      .where('organizationId', '=', input.job.organizationId)
      .where('id', '=', input.job.id)
      .where('flowRunId', '=', input.job.flowRunId)
      .where('status', '=', 'running')
      .returning('id')
      .executeTakeFirst()
    if (!job)
      return { persisted: false as const }

    const outputFolder = await ensureFlowOutputFolder(trx, {
      flowId: input.job.flowId,
      organizationId: input.job.organizationId,
    })
    const folderId = outputFolder.status === 'ready' ? outputFolder.folderId : null
    if (outputFolder.status !== 'ready') {
      logRunEngine('warn', 'generation_job.asset_output.folder_unavailable', {
        flowId: input.job.flowId,
        generationJobId: input.job.id,
        organizationId: input.job.organizationId,
        reason: outputFolder.status,
        runId: input.job.flowRunId,
      })
    }

    const existingAsset = await trx.selectFrom('assets')
      .select(['folderId', 'id', 'processingState'])
      .where('organizationId', '=', input.job.organizationId)
      .where('generationJobId', '=', input.job.id)
      .where('outputIndex', '=', input.outputIndex)
      .executeTakeFirst()
    if (existingAsset) {
      if (existingAsset.folderId === null && folderId !== null) {
        await trx.updateTable('assets')
          .set({ folderId })
          .where('organizationId', '=', input.job.organizationId)
          .where('id', '=', existingAsset.id)
          .where('folderId', 'is', null)
          .execute()
      }
      return {
        assetId: existingAsset.id,
        persisted: true as const,
        processingState: existingAsset.processingState,
        reused: true as const,
      }
    }

    await trx.insertInto('assets')
      .values({
        createdBy: input.job.createdBy,
        folderId,
        generationJobId: input.job.id,
        id: input.assetId,
        metadata: input.metadata ? { ...input.metadata } : undefined,
        mimeType: input.mimeType,
        name: `Generated ${input.job.model}`,
        organizationId: input.job.organizationId,
        outputIndex: input.outputIndex,
        processingState: 'processing',
        source: 'generation',
        storageKey: input.key,
        type: input.job.mediaType,
        visibility: input.visibility,
      })
      .execute()
    return {
      assetId: input.assetId,
      persisted: true as const,
      processingState: 'processing',
      reused: false as const,
    }
  })
}

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

async function isAssetAlreadyReady(input: {
  assetId: string
  organizationId: string
}) {
  const asset = await db.selectFrom('assets')
    .select('id')
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.assetId)
    .where('processingState', '=', 'ready')
    .where('deletedAt', 'is', null)
    .where('purgeRequestedAt', 'is', null)
    .where('purgedAt', 'is', null)
    .executeTakeFirst()
  return Boolean(asset)
}

async function ingestCommittedAssetOutput(input: {
  assetId: string
  job: FinalizableGenerationJob
  outputIndex: number
}) {
  const idempotencyKey = await idempotencyKeys.create(input.assetId, { scope: 'global' })
  const ingest = await assetIngestTask.triggerAndWait({
    assetId: input.assetId,
    organizationId: input.job.organizationId,
  }, { idempotencyKey })
  if (!ingest.ok)
    throw new Error('generation_asset_ingest_failed')
  const ready = ingest.output.state === 'ready'
    || (ingest.output.state === 'skipped'
      && await isAssetAlreadyReady({
        assetId: input.assetId,
        organizationId: input.job.organizationId,
      }))
  if (!ready)
    throw new Error(`generation_asset_ingest_not_ready:${ingest.output.state}`)
  logRunEngine('info', 'generation_job.asset_ingest.succeeded', {
    assetId: input.assetId,
    generationJobId: input.job.id,
    organizationId: input.job.organizationId,
    outputIndex: input.outputIndex,
    runId: input.job.flowRunId,
  })
}

async function finalizeTextOutput(
  job: FinalizableGenerationJob,
  output: NormalizedGenerationOutput,
) {
  if (output.payload.delivery !== 'text')
    throw new Error('generation_text_delivery_invalid')
  return persistTextOutputIfJobRunning({
    job,
    outputIndex: output.outputIndex,
    text: output.payload.text,
  })
}

async function finalizeMediaOutput(
  job: FinalizableGenerationJob & { mediaType: 'audio' | 'image' | 'video' },
  output: NormalizedGenerationOutput,
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
      await copyObject({
        bucket: output.payload.bucket,
        destinationBucket: storage.bucket,
        destinationKey: storage.key,
        sourceBucket: output.payload.bucket,
        sourceKey: output.payload.key,
      })
    }
    else {
      await putObject({
        body: output.payload.bytes,
        bucket: storage.bucket,
        contentType: output.payload.mimeType,
        key: storage.key,
      })
    }
    wroteObject = true
  }
  const persisted = await persistAssetOutputIfJobRunning({
    assetId,
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
    job,
    outputIndex: output.outputIndex,
  })
  return true
}

/** Persists normalized provider outputs through one canonical text/Asset path. */
export async function finalizeGenerationOutputs(input: {
  job: FinalizableGenerationJob
  outputs: readonly NormalizedGenerationOutput[]
}) {
  const outputs = [...input.outputs].toSorted(
    (left, right) => left.outputIndex - right.outputIndex,
  )
  for (const output of outputs) {
    if (output.mediaType !== input.job.mediaType)
      throw new Error('generation_output_media_type_mismatch')
    if (!await claimRunningJob({
      jobId: input.job.id,
      organizationId: input.job.organizationId,
      runId: input.job.flowRunId,
      stage: `output:${output.outputIndex}`,
    })) {
      await aggregateJobState(input.job, input.job.organizationId)
      return { state: 'canceled' as const }
    }
    const persisted = input.job.mediaType === 'text'
      ? await finalizeTextOutput(input.job, output)
      : await finalizeMediaOutput(
          input.job as FinalizableGenerationJob & {
            mediaType: 'audio' | 'image' | 'video'
          },
          output,
        )
    if (!persisted) {
      await aggregateJobState(input.job, input.job.organizationId)
      return { state: 'canceled' as const }
    }
  }
  return { state: 'succeeded' as const }
}
