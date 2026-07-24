/** Asset metadata and Project/folder move workflows with API presentation. */

import {
  moveAssetRows,
  updateAssetRow,
} from '../data/asset-location.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  presentAssetForUser,
  presentAssetsForUser,
} from './assets-presentation.service.js'

/** Updates one Asset and returns its user-specific presented representation. */
export async function updateAsset(input: {
  folderId?: null | string
  id: string
  name?: string
  organizationId: string
  projectId?: null | string
  userId: string
}) {
  const result = await updateAssetRow(input)
  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError(result.field)
  if (result.status === 'invalid_state') {
    throw new HttpError(
      409,
      'invalid_state',
      'The asset can no longer be updated.',
    )
  }
  return presentAssetForUser({
    asset: result.asset,
    organizationId: input.organizationId,
    userId: input.userId,
  })
}

/** Moves a bounded Asset selection to one exact Project/folder destination. */
export async function moveAssets(input: {
  assetIds: string[]
  folderId: null | string
  organizationId: string
  projectId?: null | string
  userId: string
}) {
  const result = await moveAssetRows(input)
  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError(result.field)
  if (result.status === 'invalid_state') {
    throw new HttpError(
      409,
      'invalid_state',
      'One or more assets can no longer be updated.',
    )
  }
  return {
    data: await presentAssetsForUser({
      assets: result.assets,
      organizationId: input.organizationId,
      userId: input.userId,
    }),
  }
}
