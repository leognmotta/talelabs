import type { AssetTaskPayload } from './asset-task.js'

import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { db } from '@talelabs/db'
import {
  buildThumbnailObjectKey,
  deleteObject,
  getObject,
  putObject,
  TALELABS_PRIVATE_BUCKET,
} from '@talelabs/storage'

import { getMediaProcessor } from './processor-registry.js'

async function downloadToFile(key: string, path: string) {
  const object = await getObject({ bucket: TALELABS_PRIVATE_BUCKET, key })
  if (!object.Body)
    throw new Error('Stored media has no body.')

  if (object.Body instanceof Readable) {
    const { createWriteStream } = await import('node:fs')
    await pipeline(object.Body, createWriteStream(path))
    return
  }

  const bytes = await object.Body.transformToByteArray()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(path, bytes)
}

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

  const thumbnailKey = buildThumbnailObjectKey(
    payload.organizationId,
    payload.assetId,
  )

  await downloadToFile(asset.storageKey, input.sourcePath)
  const result = await getMediaProcessor(asset.type).process(input)

  if (result.thumbnail) {
    await putObject({
      body: result.thumbnail,
      bucket: TALELABS_PRIVATE_BUCKET,
      contentType: 'image/jpeg',
      key: thumbnailKey,
    })
  }

  const update = await db.updateTable('assets')
    .set({
      durationSeconds: result.durationSeconds,
      height: result.height,
      metadata: result.metadata,
      processingError: null,
      processingState: 'ready',
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
    await deleteObject({ bucket: TALELABS_PRIVATE_BUCKET, key: thumbnailKey })

  return { state: purgeWon ? 'purge_won' as const : 'superseded' as const }
}

export async function markAssetProcessingFailed(payload: AssetTaskPayload) {
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
    await deleteObject({
      bucket: TALELABS_PRIVATE_BUCKET,
      key: buildThumbnailObjectKey(payload.organizationId, payload.assetId),
    })
  }
}
