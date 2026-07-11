import type { AssetSource, AssetType } from '@talelabs/db'

import { createDownloadUrl, TALELABS_PRIVATE_BUCKET } from '@talelabs/storage'
import { idempotencyKeys, triggerTask } from '@talelabs/trigger'

import {
  listAssetTagRows,
  listFavoriteAssetIds,
} from '../data/asset-metadata.data.js'
import {
  archiveAssetRow,
  findAssetById,
  findFolderById,
  getAssetDetailRelations,
  listAssetRows,
  listAssetUsageRows,
  moveAssetRows,
  requestAssetPurge,
  restoreAssetRow,
  updateAssetRow,
} from '../data/assets.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  parseNullableNumberCursorValue,
  parseStringCursorValue,
  resolvePagination,
} from '../pagination/pagination.js'
import {
  getAssetLifecycle,
  presentAsset,
  presentGenerationProvenance,
  toWireJsonObject,
} from './asset-presenter.js'

const assetPaginationConfig = {
  cursorValueParsers: {
    createdAt: parseIsoTimestampCursorValue,
    name: parseStringCursorValue,
    sizeBytes: parseNullableNumberCursorValue,
  },
  defaultOrder: 'desc' as const,
  defaultSort: 'createdAt' as const,
}

async function presentAssetsForUser(input: {
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

export async function listAssets(input: {
  archived: boolean
  cursor?: string
  elementId?: string
  favorite?: boolean
  folderId?: 'root' | string
  limit: number
  order: 'asc' | 'desc'
  organizationId: string
  role?: string
  search?: string
  sort: 'createdAt' | 'name' | 'sizeBytes'
  source?: AssetSource
  tagId?: string | string[]
  type?: AssetType | AssetType[]
  userId: string
}) {
  const pagination = resolvePagination({
    cursor: input.cursor,
    limit: input.limit,
    order: input.order,
    sort: input.sort,
  }, assetPaginationConfig)

  if (!pagination.ok)
    throw new HttpError(400, 'validation_error', 'The pagination options are invalid.', pagination.details)

  const rows = await listAssetRows({
    ...input,
    cursor: pagination.value.cursor,
    limit: pagination.value.limit,
    order: pagination.value.order,
    sort: pagination.value.sort,
    tagIds: input.tagId
      ? Array.isArray(input.tagId) ? input.tagId : [input.tagId]
      : undefined,
    types: input.type
      ? Array.isArray(input.type) ? input.type : [input.type]
      : undefined,
  })
  const page = buildCursorPage({
    rows,
    limit: pagination.value.limit,
    cursorFromRow: row => ({
      id: row.id,
      order: pagination.value.order,
      sort: pagination.value.sort,
      sortValue: pagination.value.sort === 'createdAt'
        ? row.createdAt.toISOString()
        : pagination.value.sort === 'name'
          ? row.nameSortValue
          : row.sizeBytes === null ? null : Number(row.sizeBytes),
    }),
    serialize: row => row,
  })

  return {
    data: await presentAssetsForUser({
      assets: page.data,
      organizationId: input.organizationId,
      userId: input.userId,
    }),
    nextCursor: page.nextCursor,
  }
}

export async function getAssetDetail(organizationId: string, userId: string, id: string) {
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
    elementLinks: relations.elementLinks,
    generation: relations.generation
      ? presentGenerationProvenance(relations.generation)
      : null,
    usedAsInputCount: relations.usedAsInputCount,
  }
}

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
  if (current.purgeRequestedAt)
    throw new HttpError(409, 'invalid_state', 'Permanent deletion is already in progress.')

  if (input.folderId && !(await findFolderById(input.organizationId, input.folderId)))
    throw new TenantResourceNotFoundError('folderId')

  const updated = await updateAssetRow(input)
  if (!updated)
    throw new HttpError(409, 'invalid_state', 'The asset can no longer be updated.')

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
  if (result.status === 'invalid_state')
    throw new HttpError(409, 'invalid_state', 'One or more assets can no longer be updated.')

  return {
    data: await presentAssetsForUser({
      assets: result.assets,
      organizationId: input.organizationId,
      userId: input.userId,
    }),
  }
}

export async function archiveAsset(organizationId: string, id: string) {
  const current = await findAssetById(organizationId, id)
  if (!current)
    throw new TenantResourceNotFoundError()
  if (current.purgeRequestedAt)
    throw new HttpError(409, 'invalid_state', 'Permanent deletion is already in progress.')

  await archiveAssetRow(organizationId, id)
}

export async function restoreAsset(organizationId: string, userId: string, id: string) {
  const current = await findAssetById(organizationId, id)
  if (!current)
    throw new TenantResourceNotFoundError()
  if (current.purgeRequestedAt)
    throw new HttpError(409, 'invalid_state', 'Permanent deletion is already in progress.')

  const restored = await restoreAssetRow(organizationId, id)
  if (!restored)
    throw new HttpError(409, 'invalid_state', 'The asset cannot be restored.')

  return presentAssetForUser({ asset: restored, organizationId, userId })
}

async function dispatchPurge(organizationId: string, assetId: string) {
  try {
    const idempotencyKey = await idempotencyKeys.create(assetId, {
      scope: 'global',
    })
    await triggerTask('asset-purge', { assetId, organizationId }, {
      idempotencyKey,
    })
  }
  catch (error) {
    console.error('Asset purge dispatch failed; reconciliation will retry.', {
      assetId,
      error,
      organizationId,
    })
  }
}

export async function purgeAsset(organizationId: string, userId: string, id: string) {
  const result = await requestAssetPurge(organizationId, id)

  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError()
  if (result.status === 'active_generation')
    throw new HttpError(409, 'invalid_state', 'This asset is in use by an active generation.')

  if (result.status === 'requested')
    void dispatchPurge(organizationId, id)

  return {
    asset: await presentAssetForUser({ asset: result.asset, organizationId, userId }),
    alreadyRequested: result.status === 'already_requested',
  }
}

export async function listAssetUsage(input: {
  assetId: string
  cursor?: string
  limit: number
  organizationId: string
}) {
  if (!(await findAssetById(input.organizationId, input.assetId)))
    throw new TenantResourceNotFoundError()

  const pagination = resolvePagination({
    cursor: input.cursor,
    limit: input.limit,
  }, {
    cursorValueParsers: { createdAt: parseIsoTimestampCursorValue },
    defaultOrder: 'desc',
    defaultSort: 'createdAt',
  })

  if (!pagination.ok)
    throw new HttpError(400, 'validation_error', 'The pagination options are invalid.', pagination.details)

  const rows = await listAssetUsageRows({
    assetId: input.assetId,
    cursor: pagination.value.cursor,
    limit: pagination.value.limit,
    organizationId: input.organizationId,
  })
  const page = buildCursorPage({
    rows,
    limit: pagination.value.limit,
    cursorFromRow: row => ({
      id: row.jobId,
      order: 'desc',
      sort: 'createdAt' as const,
      sortValue: row.createdAt.toISOString(),
    }),
    serialize: row => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }),
  })

  return { data: page.data, nextCursor: page.nextCursor }
}

export async function getAssetDownload(organizationId: string, id: string) {
  const asset = await findAssetById(organizationId, id)
  if (!asset || !['live', 'archived'].includes(getAssetLifecycle(asset)))
    throw new TenantResourceNotFoundError()

  const filename = encodeURIComponent(asset.name).replaceAll('%20', ' ')
  const url = await createDownloadUrl({
    bucket: TALELABS_PRIVATE_BUCKET,
    key: asset.storageKey,
    responseContentDisposition: `attachment; filename*=UTF-8''${filename}`,
    responseContentType: asset.mimeType,
  })

  return { url }
}
