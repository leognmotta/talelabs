/** Durable Asset object purge and organization storage-projection release. */

import type { AssetTaskPayload } from '../../tasks/assets/contracts.js'

import { db, releasePurgedAssetStorage } from '@talelabs/db'
import {
  buildAssetThumbnailKey,
  deleteObject,
  getAssetBucket,
} from '@talelabs/storage'

/** Deletes one purged Asset's objects and releases its stored-byte projection. */
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

  await releasePurgedAssetStorage({
    assetId: payload.assetId,
    organizationId: payload.organizationId,
  })

  return { state: 'purged' as const }
}
