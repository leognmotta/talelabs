import {
  getElementAssetRole,
  isElementType,
  upcastElementData,
} from '@talelabs/elements'

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
  const elementLinks = relations.elementLinks.map((link) => {
    if (!isElementType(link.elementType)) {
      throw new Error(
        `Stored Element type is not registered: ${link.elementType}`,
      )
    }
    const elementData = upcastElementData(
      link.elementType,
      link.elementSchemaVersion,
      link.elementData,
    ).data
    const role = getElementAssetRole(link.elementType, link.role, elementData)
    const metadata = role?.referenceMetadataSchema.safeParse(
      link.referenceMetadata,
    )
    if (!metadata?.success) {
      throw new Error(
        `Stored Element reference metadata is invalid for role ${link.role}`,
      )
    }
    return {
      elementId: link.elementId,
      isPrimary: link.isPrimary,
      referenceKind: link.referenceKind,
      referenceMetadata: metadata.data,
      role: link.role,
    }
  })

  return {
    ...presented,
    metadata: toWireJsonObject(asset.metadata),
    elementLinks,
    generation: relations.generation
      ? presentGenerationProvenance(relations.generation)
      : null,
    usedAsInputCount: relations.usedAsInputCount,
  }
}
