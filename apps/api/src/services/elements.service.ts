/**
 * Element workflows: list, create, read, update, delete, and atomic
 * reference mutation. Elements reuse canonical Assets; no upload, folder,
 * or provider behavior lives here.
 */

import type { ElementKind } from '@talelabs/assets'
import type { AssetRecord } from '../data/assets.data.js'
import type {
  ElementListRow,
  ElementRecord,
} from '../data/elements.data.js'

import { createId } from '@paralleldrive/cuid2'
import { MAX_ELEMENT_REFERENCES } from '@talelabs/assets'

import {
  deleteElementRow,
  findElementRow,
  insertElementRowWithReferences,
  listElementCoverAssetRows,
  listElementReferenceAssetRows,
  listElementRows,
  mutateElementReferenceRows,
  updateElementRowWithReferences,
} from '../data/elements.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../pagination/pagination.js'
import { presentAsset } from './asset-presenter.js'

const elementPaginationConfig = {
  cursorValueParsers: { updatedAt: parseIsoTimestampCursorValue },
  defaultOrder: 'desc' as const,
  defaultSort: 'updatedAt' as const,
}

/** Projects one reference Asset row into the Element API shape. */
async function presentReferenceAsset(row: AssetRecord) {
  const presented = await presentAsset(row, undefined, {
    includeOriginalUrl: true,
  })
  return {
    id: presented.id,
    name: presented.name,
    type: presented.type,
    mimeType: presented.mimeType,
    width: presented.width,
    height: presented.height,
    lifecycle: presented.lifecycle,
    processingState: presented.processingState,
    url: presented.url,
    thumbnailUrl: presented.thumbnailUrl,
    createdAt: presented.createdAt,
  }
}

function presentElement(
  element: ElementRecord,
  referenceCount: number,
  coverAsset: Awaited<ReturnType<typeof presentReferenceAsset>> | null,
) {
  return {
    id: element.id,
    name: element.name,
    kind: element.kind as ElementKind,
    description: element.description,
    referenceCount,
    coverAsset,
    createdAt: element.createdAt.toISOString(),
    updatedAt: element.updatedAt.toISOString(),
  }
}

async function presentElementDetail(element: ElementRecord) {
  const referenceRows = await listElementReferenceAssetRows(
    element.organizationId,
    element.id,
  )
  const references = await Promise.all(referenceRows.map(presentReferenceAsset))
  return {
    ...presentElement(element, references.length, references[0] ?? null),
    references,
  }
}

async function presentListRows(
  organizationId: string,
  rows: ElementListRow[],
) {
  const covers = await listElementCoverAssetRows(
    organizationId,
    rows.filter(row => row.referenceCount > 0).map(row => row.id),
  )
  const coversByElement = new Map(covers.map(cover => [cover.elementId, cover]))
  return Promise.all(rows.map(async (row) => {
    const cover = coversByElement.get(row.id)
    return presentElement(
      row,
      row.referenceCount,
      cover ? await presentReferenceAsset(cover) : null,
    )
  }))
}

/** Lists Elements for one organization as a cursor page with batched covers. */
export async function listElements(input: {
  assetId?: string
  cursor?: string
  kind?: ElementKind
  limit: number
  organizationId: string
  search?: string
}) {
  const pagination = resolvePagination({
    cursor: input.cursor,
    limit: input.limit,
    order: 'desc',
    sort: 'updatedAt',
  }, elementPaginationConfig)
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The pagination options are invalid.',
      pagination.details,
    )
  }

  const rows = await listElementRows({
    assetId: input.assetId,
    cursor: pagination.value.cursor,
    kind: input.kind,
    limit: pagination.value.limit,
    order: pagination.value.order,
    organizationId: input.organizationId,
    search: input.search,
  })
  const page = buildCursorPage({
    rows,
    limit: pagination.value.limit,
    cursorFromRow: row => ({
      id: row.id,
      order: pagination.value.order,
      sort: 'updatedAt',
      sortValue: row.updatedAt.toISOString(),
    }),
    serialize: row => row,
  })

  return {
    data: await presentListRows(input.organizationId, page.pageRows),
    nextCursor: page.nextCursor,
  }
}

function assertReferenceInput(assetIds: readonly string[]) {
  if (assetIds.length > MAX_ELEMENT_REFERENCES) {
    throw new HttpError(400, 'element_reference_limit_reached', 'An Element holds a limited number of references.', [{
      code: 'element_reference_limit_reached',
      field: 'assetIds',
      message: `Use at most ${MAX_ELEMENT_REFERENCES} reference images.`,
      params: { maximum: MAX_ELEMENT_REFERENCES },
    }])
  }
  if (new Set(assetIds).size !== assetIds.length) {
    throw new HttpError(400, 'validation_error', 'Reference Assets must be unique.', [{
      code: 'duplicate_reference_asset',
      field: 'assetIds',
      message: 'Each Asset can be referenced once per Element.',
    }])
  }
}

function throwReferenceReplacementError(
  result: { invalidAssetIds: string[], status: 'asset_not_available' | 'not_image' },
): never {
  if (result.status === 'not_image') {
    throw new HttpError(400, 'element_reference_not_image', 'Element references must be images.', [{
      code: 'element_reference_not_image',
      field: 'assetIds',
      message: 'Only image Assets can be Element references.',
    }])
  }
  throw new HttpError(400, 'asset_not_available', 'A selected Asset is not available.', [{
    code: 'asset_not_available',
    field: 'assetIds',
    message: 'Remove unavailable Assets from the selection.',
  }])
}

/** Creates an Element with its references in one transaction. */
export async function createElement(input: {
  assetIds: readonly string[]
  description: string
  kind: ElementKind
  name: string
  organizationId: string
  userId: string
}) {
  assertReferenceInput(input.assetIds)

  const result = await insertElementRowWithReferences({
    assetIds: input.assetIds,
    createdBy: input.userId,
    description: input.description,
    id: createId(),
    kind: input.kind,
    name: input.name,
    organizationId: input.organizationId,
  })
  if (result.status !== 'created')
    throwReferenceReplacementError(result)
  return presentElementDetail(result.element)
}

/** Loads one Element with its ordered, presented references. */
export async function getElementDetail(organizationId: string, id: string) {
  const element = await findElementRow(organizationId, id)
  if (!element)
    throw new TenantResourceNotFoundError()
  return presentElementDetail(element)
}

/**
 * Updates metadata and, when `assetIds` is provided, the complete ordered
 * reference list — one transaction, so one Save is one atomic operation.
 */
export async function updateElement(input: {
  assetIds?: readonly string[]
  description?: string
  id: string
  kind?: ElementKind
  name?: string
  organizationId: string
}) {
  if (input.assetIds !== undefined)
    assertReferenceInput(input.assetIds)

  const result = await updateElementRowWithReferences(input)
  if (result.status === 'element_not_found')
    throw new TenantResourceNotFoundError()
  if (result.status !== 'updated')
    throwReferenceReplacementError(result)
  return presentElementDetail(result.element)
}

/** Deletes one Element; canonical Assets are never touched. */
export async function deleteElement(organizationId: string, id: string) {
  const deleted = await deleteElementRow(organizationId, id)
  if (!deleted)
    throw new TenantResourceNotFoundError()
}

/**
 * Atomic append/remove against the current server-side reference list, used
 * by capture flows and their Undo so concurrent additions never overwrite
 * each other. Returns the detail plus exactly which Assets changed.
 */
export async function mutateElementReferences(input: {
  addAssetIds: readonly string[]
  elementId: string
  organizationId: string
  removeAssetIds: readonly string[]
}) {
  const result = await mutateElementReferenceRows(input)
  if (result.status === 'element_not_found')
    throw new TenantResourceNotFoundError()
  if (result.status !== 'mutated')
    throwReferenceReplacementError(result)

  const detail = await presentElementDetail(result.element)
  return {
    ...detail,
    addedAssetIds: result.addedAssetIds,
    removedAssetIds: result.removedAssetIds,
  }
}
