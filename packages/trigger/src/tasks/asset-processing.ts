import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  idempotencyKeys,
  queue,
  schedules,
  schemaTask,
} from '@trigger.dev/sdk'

import { assetTaskPayloadSchema } from './asset-processing/asset-task.js'
import {
  ingestAsset,
  markAssetProcessingFailed,
} from './asset-processing/ingest-asset.js'
import { InvalidMediaError } from './asset-processing/media-processor.js'
import { purgeAsset } from './asset-processing/purge-asset.js'
import { findAssetsNeedingReconciliation } from './asset-processing/reconcile-assets.js'

const ASSET_INGEST_MAX_ATTEMPTS = 3
const assetIngestionQueue = queue({
  concurrencyLimit: 2,
  name: 'asset-ingestion',
})

export const assetIngestTask = schemaTask({
  id: 'asset-ingest',
  schema: assetTaskPayloadSchema,
  queue: assetIngestionQueue,
  retry: {
    maxAttempts: ASSET_INGEST_MAX_ATTEMPTS,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
  },
  catchError: async ({ ctx, error, payload }) => {
    const invalidMedia = error instanceof InvalidMediaError
    const attemptsExhausted = ctx.attempt.number
      >= (ctx.run.maxAttempts ?? ASSET_INGEST_MAX_ATTEMPTS)

    if (invalidMedia || attemptsExhausted)
      await markAssetProcessingFailed(payload)

    if (invalidMedia)
      return { skipRetrying: true }
  },
  run: async (payload) => {
    const directory = await mkdtemp(join(tmpdir(), 'talelabs-asset-'))

    try {
      return await ingestAsset(payload, {
        directory,
        sourcePath: join(directory, 'source'),
      })
    }
    finally {
      await rm(directory, { force: true, recursive: true })
    }
  },
})

export const assetPurgeTask = schemaTask({
  id: 'asset-purge',
  schema: assetTaskPayloadSchema,
  retry: {
    maxAttempts: 8,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 60_000,
  },
  run: purgeAsset,
})

export const reconcileAssetsTask = schedules.task({
  id: 'asset-reconcile',
  cron: '*/5 * * * *',
  run: async () => {
    const { processing, purging } = await findAssetsNeedingReconciliation()

    for (const asset of processing) {
      const key = await idempotencyKeys.create(asset.id, { scope: 'global' })
      await assetIngestTask.trigger({
        assetId: asset.id,
        organizationId: asset.organizationId,
      }, { idempotencyKey: key })
    }

    for (const asset of purging) {
      const key = await idempotencyKeys.create(asset.id, { scope: 'global' })
      await assetPurgeTask.trigger({
        assetId: asset.id,
        organizationId: asset.organizationId,
      }, { idempotencyKey: key })
    }

    return {
      ingestionDispatched: processing.length,
      purgeDispatched: purging.length,
    }
  },
})
