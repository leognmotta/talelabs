/** Durable Asset ingestion and materialized storage-accounting finalization. */

import type { AssetTaskPayload } from '../../tasks/assets/contracts.js'
import { stat } from 'node:fs/promises'

import { BILLING_CATALOG, getBillingPlan } from '@talelabs/billing'
import {
  commitGeneratedAssetStorage,
  db,
  ensureOrganizationBillingState,
  reconcileExpiredPaidEntitlement,
} from '@talelabs/db'
import { readFlowRunJobRequestPayload } from '@talelabs/flows'
import {
  buildAssetThumbnailKey,
  deleteObject,
  getAssetBucket,
  putObject,
} from '@talelabs/storage'

import { getMediaProcessor } from '../media/registry.js'
import { mergeAssetMetadata } from './metadata.js'
import { downloadAssetSourceToFile } from './source-download.js'

/** Processes one tenant Asset and commits its authoritative stored-byte total. */
export async function ingestAsset(
  payload: AssetTaskPayload,
  input: { directory: string, sourcePath: string },
) {
  const asset = await db.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.assetId)
    .executeTakeFirst()

  if (
    !asset
    || asset.processingState !== 'processing'
    || asset.purgeRequestedAt
  ) {
    return { state: 'skipped' as const }
  }

  const bucket = getAssetBucket(asset.visibility)
  const thumbnailKey = buildAssetThumbnailKey({
    assetId: payload.assetId,
    organizationId: payload.organizationId,
    visibility: asset.visibility,
  })

  await downloadAssetSourceToFile(bucket, asset.storageKey, input.sourcePath)
  const source = await stat(input.sourcePath)
  const result = await getMediaProcessor(asset.type).process(input)

  if (result.thumbnail) {
    await putObject({
      body: result.thumbnail,
      bucket,
      contentType: 'image/jpeg',
      key: thumbnailKey,
    })
  }

  const update = await db.transaction().execute(async (trx) => {
    if (asset.source === 'generation') {
      await ensureOrganizationBillingState({
        catalogRevision: BILLING_CATALOG.revision,
        organizationId: payload.organizationId,
      }, trx)
      await reconcileExpiredPaidEntitlement(payload.organizationId, trx)
      const account = await trx.selectFrom('organizationBillingAccounts')
        .select('currentPlanCode')
        .where('organizationId', '=', payload.organizationId)
        .executeTakeFirstOrThrow()
      if (!asset.generationJobId)
        throw new Error('generated_asset_job_missing')
      const job = await trx.selectFrom('generationJobs')
        .select(['requestHash', 'requestPayload'])
        .where('organizationId', '=', payload.organizationId)
        .where('id', '=', asset.generationJobId)
        .executeTakeFirstOrThrow()
      const request = readFlowRunJobRequestPayload(job)
      const storageCommit = await commitGeneratedAssetStorage({
        assetId: payload.assetId,
        organizationId: payload.organizationId,
        outputCount: request.outputCount,
        sizeBytes: source.size,
        storageLimitBytes: getBillingPlan(account.currentPlanCode).storageBytes,
      }, trx)
      if (storageCommit.state === 'purge_won')
        return null
    }
    return trx.updateTable('assets')
      .set({
        durationSeconds: result.durationSeconds,
        height: result.height,
        metadata: mergeAssetMetadata(asset.metadata, result.metadata),
        processingError: null,
        processingState: 'ready',
        sizeBytes: source.size,
        thumbnailKey: result.thumbnail ? thumbnailKey : null,
        updatedAt: new Date(),
        width: result.width,
      })
      .where('organizationId', '=', payload.organizationId)
      .where('id', '=', payload.assetId)
      .where('processingState', '=', 'processing')
      .where('purgeRequestedAt', 'is', null)
      .executeTakeFirst()
  })

  if (update && update.numUpdatedRows > 0n)
    return { state: 'ready' as const }

  const current = await db.selectFrom('assets')
    .select(['purgeRequestedAt', 'purgedAt'])
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.assetId)
    .executeTakeFirst()
  const purgeWon = Boolean(current?.purgeRequestedAt || current?.purgedAt)

  if (purgeWon && result.thumbnail)
    await deleteObject({ bucket, key: thumbnailKey })

  return { state: purgeWon ? 'purge_won' as const : 'superseded' as const }
}

/** Marks one failed processing attempt without racing a requested purge. */
export async function markAssetProcessingFailed(payload: AssetTaskPayload) {
  const asset = await db.selectFrom('assets')
    .select(['id', 'visibility'])
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.assetId)
    .executeTakeFirst()
  if (!asset)
    return

  const update = await db.updateTable('assets')
    .set({
      processingError: 'This media file could not be processed.',
      processingState: 'failed',
      updatedAt: new Date(),
    })
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.assetId)
    .where('processingState', '=', 'processing')
    .where('purgeRequestedAt', 'is', null)
    .executeTakeFirst()

  if (update.numUpdatedRows > 0n) {
    const bucket = getAssetBucket(asset.visibility)
    await deleteObject({
      bucket,
      key: buildAssetThumbnailKey({
        assetId: payload.assetId,
        organizationId: payload.organizationId,
        visibility: asset.visibility,
      }),
    })
  }
}
