import type { AssetTaskPayload } from './asset-task.js'

import { db } from '@talelabs/db'
import {
  buildAssetThumbnailKey,
  deleteObject,
  getAssetBucket,
} from '@talelabs/storage'

export async function purgeAsset(payload: AssetTaskPayload) {
  const asset = await db.selectFrom('assets')
    .select(['storageKey', 'visibility', 'purgeRequestedAt', 'purgedAt'])
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.assetId)
    .executeTakeFirst()

  if (!asset?.purgeRequestedAt || asset.purgedAt)
    return { state: 'skipped' as const }

  const bucket = getAssetBucket(asset.visibility)
  await deleteObject({ bucket, key: asset.storageKey })
  await deleteObject({
    bucket,
    key: buildAssetThumbnailKey({
      assetId: payload.assetId,
      organizationId: payload.organizationId,
      visibility: asset.visibility,
    }),
  })

  await db.updateTable('assets')
    .set({ purgedAt: new Date(), updatedAt: new Date() })
    .where('organizationId', '=', payload.organizationId)
    .where('id', '=', payload.assetId)
    .where('purgeRequestedAt', 'is not', null)
    .where('purgedAt', 'is', null)
    .execute()

  return { state: 'purged' as const }
}
