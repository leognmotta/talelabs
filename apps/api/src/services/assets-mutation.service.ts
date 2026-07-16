import {
  findAssetById,
  findFolderById,
  moveAssetRows,
  updateAssetRow,
} from '../data/assets.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  presentAssetForUser,
  presentAssetsForUser,
} from './assets-presentation.service.js'

export async function updateAsset(input: {
  folderId?: null | string
  id: string
  name?: string
  organizationId: string
  userId: string
}) {
  const current = await findAssetById(input.organizationId, input.id)
  if (!current)
    throw new TenantResourceNotFoundError()
  if (current.purgeRequestedAt) {
    throw new HttpError(
      409,
      'invalid_state',
      'Permanent deletion is already in progress.',
    )
  }
  if (
    input.folderId
    && !(await findFolderById(input.organizationId, input.folderId))
  ) {
    throw new TenantResourceNotFoundError('folderId')
  }
  const updated = await updateAssetRow(input)
  if (!updated) {
    throw new HttpError(
      409,
      'invalid_state',
      'The asset can no longer be updated.',
    )
  }
  return presentAssetForUser({
    asset: updated,
    organizationId: input.organizationId,
    userId: input.userId,
  })
}

export async function moveAssets(input: {
  assetIds: string[]
  folderId: null | string
  organizationId: string
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
