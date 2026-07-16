import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { queue, schemaTask } from '@trigger.dev/sdk'

import { InvalidMediaError } from '../../assets/media/contracts.js'
import {
  ingestAsset,
  markAssetProcessingFailed,
} from '../../assets/processing/ingest.js'
import { assetTaskPayloadSchema } from './contracts.js'

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
