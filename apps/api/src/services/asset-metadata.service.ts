import {
  mutateAssetFavoriteRow,
  mutateAssetTagRow,
} from '../data/asset-metadata.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'

function assertMetadataMutation(result: Awaited<ReturnType<typeof mutateAssetFavoriteRow>>) {
  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError(result.field)
  if (result.status === 'invalid_state')
    throw new HttpError(409, 'invalid_state', 'The asset can no longer be updated.')
}

export async function favoriteAsset(input: {
  assetId: string
  organizationId: string
  userId: string
}) {
  assertMetadataMutation(await mutateAssetFavoriteRow({ ...input, favorite: true }))
}

export async function unfavoriteAsset(input: {
  assetId: string
  organizationId: string
  userId: string
}) {
  assertMetadataMutation(await mutateAssetFavoriteRow({ ...input, favorite: false }))
}

export async function addAssetTag(input: {
  assetId: string
  organizationId: string
  tagId: string
  userId: string
}) {
  assertMetadataMutation(await mutateAssetTagRow({ ...input, assigned: true }))
}

export async function removeAssetTag(input: {
  assetId: string
  organizationId: string
  tagId: string
}) {
  assertMetadataMutation(await mutateAssetTagRow({ ...input, assigned: false }))
}
