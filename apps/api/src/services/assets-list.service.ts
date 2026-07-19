/** Asset list and usage workflows: filtering, pagination, and presentation. */

import type { AssetSource, AssetType } from '@talelabs/db'

import {
  findAssetById,
  listAssetRows,
  listAssetUsageRows,
} from '../data/assets.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  parseNullableNumberCursorValue,
  parseStringCursorValue,
  resolvePagination,
} from '../pagination/pagination.js'
import { presentAssetsForUser } from './assets-presentation.service.js'

const assetPaginationConfig = {
  cursorValueParsers: {
    createdAt: parseIsoTimestampCursorValue,
    name: parseStringCursorValue,
    sizeBytes: parseNullableNumberCursorValue,
  },
  defaultOrder: 'desc' as const,
  defaultSort: 'createdAt' as const,
}

/** Lists Assets for one organization as a cursor page with presentation. */
export async function listAssets(input: {
  archived: boolean
  cursor?: string
  elementId?: string
  favorite?: boolean
  folderId?: 'root' | string
  limit: number
  order: 'asc' | 'desc'
  organizationId: string
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
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The pagination options are invalid.',
      pagination.details,
    )
  }
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

/** Pages the Flows and jobs that reference one Asset. */
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
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The pagination options are invalid.',
      pagination.details,
    )
  }
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
