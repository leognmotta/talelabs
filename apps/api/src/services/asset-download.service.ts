import { ensureAssetFileExtension } from '@talelabs/assets'
import { createDownloadUrl, getAssetBucket } from '@talelabs/storage'

import { findAssetById } from '../data/assets.data.js'
import { TenantResourceNotFoundError } from '../middleware/error.js'
import { getAssetLifecycle } from './asset-presenter.js'

export async function getAssetDownload(organizationId: string, id: string) {
  const asset = await findAssetById(organizationId, id)
  if (!asset || !['live', 'archived'].includes(getAssetLifecycle(asset)))
    throw new TenantResourceNotFoundError()

  const filename = encodeURIComponent(
    ensureAssetFileExtension(asset.name, asset.mimeType),
  ).replaceAll('%20', ' ')
  const url = await createDownloadUrl({
    bucket: getAssetBucket(asset.visibility),
    key: asset.storageKey,
    responseContentDisposition: `attachment; filename*=UTF-8''${filename}`,
    responseContentType: asset.mimeType,
  })
  return { url }
}
