/** Canonical Asset persistence and ingestion dispatch for generated media outputs. */

import type { AssetVisibility } from '@talelabs/storage'
import type {
  FinalizableGenerationJob,
  GenerationOutputCommitGuard,
} from './finalizer.js'

import { db } from '@talelabs/db'
import { idempotencyKeys } from '@trigger.dev/sdk'

import { ensureFlowOutputFolder } from '../../../assets/outputs/folders.js'
import { assetIngestTask } from '../../../tasks/assets/ingest.task.js'
import { logRunEngine } from '../../observability/logging.js'

/** Creates or reuses one canonical Asset while the owning run and job remain writable. */
export async function persistAssetOutputIfJobRunning(input: {
  assetId: string
  commitGuard?: GenerationOutputCommitGuard
  job: FinalizableGenerationJob & { mediaType: 'audio' | 'image' | 'video' }
  key: string
  metadata?: Readonly<Record<string, boolean | number | string>>
  mimeType: string
  outputIndex: number
  visibility: AssetVisibility
}) {
  return db.transaction().execute(async (trx) => {
    await input.commitGuard?.({
      job: input.job,
      outputIndex: input.outputIndex,
      trx,
    })
    const run = await trx
      .selectFrom('flowRuns')
      .select('status')
      .where('organizationId', '=', input.job.organizationId)
      .where('id', '=', input.job.flowRunId)
      .forUpdate()
      .executeTakeFirst()
    if (run?.status === 'canceled')
      return { persisted: false as const }
    const job = await trx
      .updateTable('generationJobs')
      .set({ status: 'running' })
      .where('organizationId', '=', input.job.organizationId)
      .where('id', '=', input.job.id)
      .where('flowRunId', '=', input.job.flowRunId)
      .where('status', '=', 'running')
      .returning('id')
      .executeTakeFirst()
    if (!job)
      return { persisted: false as const }

    const outputFolder = input.job.flowId
      ? await ensureFlowOutputFolder(trx, {
          flowId: input.job.flowId,
          organizationId: input.job.organizationId,
        })
      : null
    const folderId
      = outputFolder?.status === 'ready' ? outputFolder.folderId : null
    if (outputFolder && outputFolder.status !== 'ready') {
      logRunEngine('warn', 'generation_job.asset_output.folder_unavailable', {
        flowId: input.job.flowId,
        generationJobId: input.job.id,
        organizationId: input.job.organizationId,
        reason: outputFolder.status,
        runId: input.job.flowRunId,
      })
    }

    const existingAsset = await trx
      .selectFrom('assets')
      .select(['folderId', 'id', 'processingState'])
      .where('organizationId', '=', input.job.organizationId)
      .where('generationJobId', '=', input.job.id)
      .where('outputIndex', '=', input.outputIndex)
      .executeTakeFirst()
    if (existingAsset) {
      if (existingAsset.folderId === null && folderId !== null) {
        await trx
          .updateTable('assets')
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

    await trx
      .insertInto('assets')
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

/** Returns whether the tenant-owned Asset is live and ready for downstream use. */
export async function isAssetAlreadyReady(input: {
  assetId: string
  organizationId: string
}) {
  const asset = await db
    .selectFrom('assets')
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

/** Dispatches canonical Asset ingestion from either a Trigger task or API driver. */
export async function ingestCommittedAssetOutput(input: {
  assetId: string
  dispatch?: 'api' | 'task'
  job: FinalizableGenerationJob
  outputIndex: number
}) {
  const idempotencyKey = await idempotencyKeys.create(input.assetId, {
    scope: 'global',
  })
  if (input.dispatch === 'api') {
    await assetIngestTask.trigger(
      {
        assetId: input.assetId,
        organizationId: input.job.organizationId,
      },
      { idempotencyKey },
    )
    logRunEngine('info', 'generation_job.asset_ingest.dispatched', {
      assetId: input.assetId,
      generationJobId: input.job.id,
      organizationId: input.job.organizationId,
      outputIndex: input.outputIndex,
      runId: input.job.flowRunId,
    })
    return
  }
  const ingest = await assetIngestTask.triggerAndWait(
    {
      assetId: input.assetId,
      organizationId: input.job.organizationId,
    },
    { idempotencyKey },
  )
  if (!ingest.ok)
    throw new Error('generation_asset_ingest_failed')
  const ready
    = ingest.output.state === 'ready'
      || (ingest.output.state === 'skipped'
        && (await isAssetAlreadyReady({
          assetId: input.assetId,
          organizationId: input.job.organizationId,
        })))
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
