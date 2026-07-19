/** Assembles render-complete Asset detail: metadata, tags, and provenance. */

import {
  listAssetTagRows,
  listFavoriteAssetIds,
} from '../data/asset-metadata.data.js'
import {
  findAssetById,
  getAssetDetailRelations,
} from '../data/assets.data.js'
import { TenantResourceNotFoundError } from '../middleware/error.js'
import {
  presentAsset,
  presentGenerationProvenance,
  toWireJsonObject,
} from './asset-presenter.js'

/** Presents Assets with the user's favorite and tag state attached. */
export async function presentAssetsForUser(input: {
  assets: NonNullable<Awaited<ReturnType<typeof findAssetById>>>[]
  organizationId: string
  userId: string
}) {
  const assetIds = input.assets.map(asset => asset.id)
  const [favorites, tagRows] = await Promise.all([
    listFavoriteAssetIds({
      assetIds,
      organizationId: input.organizationId,
      userId: input.userId,
    }),
    listAssetTagRows({ assetIds, organizationId: input.organizationId }),
  ])
  const favoriteIds = new Set(favorites.map(row => row.assetId))
  const tagsByAssetId = new Map<string, typeof tagRows>()

  for (const tag of tagRows) {
    const tags = tagsByAssetId.get(tag.assetId) ?? []
    tags.push(tag)
    tagsByAssetId.set(tag.assetId, tags)
  }

  return Promise.all(input.assets.map(asset => presentAsset(asset, {
    favorite: favoriteIds.has(asset.id),
    tags: (tagsByAssetId.get(asset.id) ?? []).map(tag => ({
      createdAt: tag.createdAt.toISOString(),
      id: tag.id,
      name: tag.name,
      updatedAt: tag.updatedAt.toISOString(),
    })),
  })))
}

/** Presents one Asset with the user's favorite and tag state attached. */
export async function presentAssetForUser(input: {
  asset: NonNullable<Awaited<ReturnType<typeof findAssetById>>>
  organizationId: string
  userId: string
}) {
  const assets = await presentAssetsForUser({
    assets: [input.asset],
    organizationId: input.organizationId,
    userId: input.userId,
  })
  return assets[0]!
}

/** Assembles render-complete Asset detail: metadata, tags, and provenance. */
export async function getAssetDetail(
  organizationId: string,
  userId: string,
  id: string,
) {
  const asset = await findAssetById(organizationId, id)
  if (!asset)
    throw new TenantResourceNotFoundError()

  const [presentedAssets, relations] = await Promise.all([
    presentAssetsForUser({ assets: [asset], organizationId, userId }),
    getAssetDetailRelations(organizationId, asset),
  ])
  const presented = presentedAssets[0]!

  return {
    ...presented,
    metadata: toWireJsonObject(asset.metadata),
    generation: relations.generation
      ? presentGenerationProvenance(relations.generation)
      : null,
    usedAsInputCount: relations.usedAsInputCount,
  }
}
