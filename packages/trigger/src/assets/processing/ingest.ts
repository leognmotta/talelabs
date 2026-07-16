import type { AssetTaskPayload } from '../../tasks/assets/contracts.js'
import { stat } from 'node:fs/promises'

import { db } from '@talelabs/db'
import {
  buildAssetThumbnailKey,
  deleteObject,
  getAssetBucket,
  putObject,
} from '@talelabs/storage'

import { getMediaProcessor } from '../media/registry.js'
import { mergeAssetMetadata } from './metadata.js'
import { downloadAssetSourceToFile } from './source-download.js'

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

  const update = await db.updateTable('assets')
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

  if (update.numUpdatedRows > 0n)
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
