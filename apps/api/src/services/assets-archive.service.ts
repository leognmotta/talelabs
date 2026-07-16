import {
  archiveAssetRow,
  findAssetById,
  restoreAssetRow,
} from '../data/assets.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import { presentAssetForUser } from './assets-presentation.service.js'

export async function archiveAsset(organizationId: string, id: string) {
  const current = await findAssetById(organizationId, id)
  if (!current)
    throw new TenantResourceNotFoundError()
  if (current.purgeRequestedAt) {
    throw new HttpError(
      409,
      'invalid_state',
      'Permanent deletion is already in progress.',
    )
  }
  await archiveAssetRow(organizationId, id)
}

export async function restoreAsset(
  organizationId: string,
  userId: string,
  id: string,
) {
  const current = await findAssetById(organizationId, id)
  if (!current)
    throw new TenantResourceNotFoundError()
  if (current.purgeRequestedAt) {
    throw new HttpError(
      409,
      'invalid_state',
      'Permanent deletion is already in progress.',
    )
  }
  const restored = await restoreAssetRow(organizationId, id)
  if (!restored) {
    throw new HttpError(
      409,
      'invalid_state',
      'The asset cannot be restored.',
    )
  }
  return presentAssetForUser({ asset: restored, organizationId, userId })
}
