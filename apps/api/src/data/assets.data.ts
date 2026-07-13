import type {
  AssetSource,
  AssetTable,
  AssetType,
  Database,
  JsonValue,
} from '@talelabs/db'
import type { ElementReferenceKind } from '@talelabs/elements'
import type { Selectable, Transaction } from 'kysely'
import type { PageCursor, SortOrder } from '../pagination/cursor.js'

import { db, sql } from '@talelabs/db'
import {
  insertPreparedElementAssetAttachment,
  prepareElementAssetAttachment,
} from './element-asset-links.data.js'
import {
  lockFolderStructure,
  provisionElementAssetFolderRow,
} from './folders.data.js'

export type AssetRecord = Selectable<AssetTable>
export type AssetListRow = AssetRecord & { nameSortValue: string }
export type AssetSort = 'createdAt' | 'name' | 'sizeBytes'

export interface ListAssetRowsInput {
  archived: boolean
  cursor: PageCursor<AssetSort> | null
  elementId?: string
  favorite?: boolean
  folderId?: 'root' | string
  limit: number
  order: SortOrder
  organizationId: string
  role?: string
  search?: string
  sort: AssetSort
  source?: AssetSource
  tagIds?: string[]
  types?: AssetType[]
  userId: string
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function assetCursorCondition(cursor: PageCursor<AssetSort>) {
  const direction = cursor.order === 'asc' ? sql`>` : sql`<`

  if (cursor.sort === 'createdAt') {
    const value = new Date(String(cursor.sortValue))
    return sql<boolean>`(
      a."createdAt" ${direction} ${value}
      or (a."createdAt" = ${value} and a."id" ${direction} ${cursor.id})
    )`
  }

  if (cursor.sort === 'name') {
    const value = String(cursor.sortValue)
    return sql<boolean>`(
      lower(a."name") ${direction} ${value}
      or (lower(a."name") = ${value} and a."id" ${direction} ${cursor.id})
    )`
  }

  if (cursor.sortValue === null) {
    return sql<boolean>`a."sizeBytes" is null and a."id" ${direction} ${cursor.id}`
  }

  const value = Number(cursor.sortValue)
  return cursor.order === 'asc'
    ? sql<boolean>`(
        a."sizeBytes" > ${value}
        or a."sizeBytes" is null
        or (a."sizeBytes" = ${value} and a."id" > ${cursor.id})
      )`
    : sql<boolean>`(
        a."sizeBytes" < ${value}
        or a."sizeBytes" is null
        or (a."sizeBytes" = ${value} and a."id" < ${cursor.id})
      )`
}

function assetOrderBy(sort: AssetSort, order: SortOrder) {
  const direction = sql.raw(order)

  if (sort === 'name')
    return sql`lower(a."name") ${direction}, a."id" ${direction}`

  if (sort === 'sizeBytes') {
    return sql`
      a."sizeBytes" ${direction} nulls last,
      a."id" ${direction}
    `
  }

  return sql`a."createdAt" ${direction}, a."id" ${direction}`
}

export async function listAssetRows(input: ListAssetRowsInput) {
  const conditions = [
    sql<boolean>`a."organizationId" = ${input.organizationId}`,
    sql<boolean>`a."purgeRequestedAt" is null`,
    input.archived
      ? sql<boolean>`a."deletedAt" is not null`
      : sql<boolean>`a."deletedAt" is null`,
  ]

  if (input.types?.length) {
    conditions.push(sql<boolean>`a."type" in (${sql.join(
      input.types.map(type => sql`${type}`),
    )})`)
  }

  if (input.source)
    conditions.push(sql<boolean>`a."source" = ${input.source}`)

  if (input.favorite) {
    conditions.push(sql<boolean>`exists (
      select 1 from "assetFavorites" favorite
      where favorite."organizationId" = ${input.organizationId}
        and favorite."userId" = ${input.userId}
        and favorite."assetId" = a."id"
    )`)
  }

  if (input.tagIds?.length) {
    conditions.push(sql<boolean>`exists (
      select 1 from "assetTags" asset_tag
      where asset_tag."organizationId" = ${input.organizationId}
        and asset_tag."assetId" = a."id"
        and asset_tag."tagId" in (${sql.join(input.tagIds.map(id => sql`${id}`))})
    )`)
  }

  if (input.folderId === 'root')
    conditions.push(sql<boolean>`a."folderId" is null`)
  else if (input.folderId)
    conditions.push(sql<boolean>`a."folderId" = ${input.folderId}`)

  if (input.search) {
    const pattern = `%${escapeLike(input.search)}%`
    conditions.push(sql<boolean>`a."name" ilike ${pattern} escape '\\'`)
  }

  if (input.elementId) {
    conditions.push(sql<boolean>`exists (
      select 1 from "elementAssets" ea
      where ea."organizationId" = ${input.organizationId}
        and ea."elementId" = ${input.elementId}
        and ea."assetId" = a."id"
        ${input.role ? sql`and ea."role" = ${input.role}` : sql``}
    )`)
  }

  if (input.cursor)
    conditions.push(assetCursorCondition(input.cursor))

  const result = await sql<AssetListRow>`
    select a.*, lower(a."name") as "nameSortValue"
    from "assets" a
    where ${sql.join(conditions, sql` and `)}
    order by ${assetOrderBy(input.sort, input.order)}
    limit ${input.limit + 1}
  `.execute(db)

  return result.rows
}

export function findAssetById(organizationId: string, id: string) {
  return db.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

export function findAssetByUploadId(organizationId: string, uploadId: string) {
  return db.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('uploadId', '=', uploadId)
    .executeTakeFirst()
}

export function findFolderById(organizationId: string, id: string) {
  return db.selectFrom('folders')
    .select(['id'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

export async function insertUploadedAsset(input: {
  createdBy: string
  folderId: null | string
  id: string
  mimeType: string
  name: string
  organizationId: string
  sizeBytes: number
  storageKey: string
  type: AssetType
  uploadId: string
  elementId?: string
  isPrimary?: boolean
  referenceKind?: ElementReferenceKind
  referenceMetadata?: unknown
  role?: string
  sortOrder?: number
  validateFlowReferenceBudgets: (
    executor: Transaction<Database>,
  ) => Promise<void>
}) {
  return db.transaction().execute(async (trx) => {
    let folderId = input.folderId
    const createsElementLink = input.elementId !== undefined && input.role !== undefined
    const referenceKind = input.referenceKind ?? 'master'
    let preparedLink: Awaited<ReturnType<typeof prepareElementAssetAttachment>> | undefined

    if (createsElementLink) {
      preparedLink = await prepareElementAssetAttachment(trx, {
        assetId: input.id,
        assetType: input.type,
        elementId: input.elementId!,
        isPrimary: input.isPrimary ?? false,
        lockFolder: true,
        organizationId: input.organizationId,
        referenceKind,
        referenceMetadata: input.referenceMetadata ?? {},
        role: input.role!,
      })
      if (preparedLink.status !== 'prepared')
        return preparedLink
    }

    if (input.elementId) {
      // Folder deletion takes the same advisory lock before its FK action updates
      // Elements. Keep this lock order consistent to avoid an Element/folder
      // deadlock while lazily recreating an association.
      if (!createsElementLink)
        await lockFolderStructure(trx, input.organizationId)
      const element = preparedLink?.status === 'prepared'
        ? preparedLink.element
        : await trx.selectFrom('elements')
            .select([
              'assetFolderId',
              'data',
              'id',
              'name',
              'schemaVersion',
              'type',
            ])
            .where('organizationId', '=', input.organizationId)
            .where('id', '=', input.elementId)
            .forUpdate()
            .executeTakeFirst()
      if (!element)
        return { status: 'element_not_found' as const }

      if (element.assetFolderId) {
        folderId = element.assetFolderId
      }
      else {
        const provisioned = await provisionElementAssetFolderRow(trx, {
          elementName: element.name,
          organizationId: input.organizationId,
        })
        if (provisioned.status === 'limit')
          return { status: 'folder_limit' as const }
        if (provisioned.status === 'depth')
          return { status: 'folder_depth' as const }

        folderId = provisioned.folderId
        await trx.updateTable('elements')
          .set({ assetFolderId: folderId, updatedAt: new Date() })
          .where('organizationId', '=', input.organizationId)
          .where('id', '=', input.elementId)
          .executeTakeFirstOrThrow()
      }
    }

    const {
      elementId: _elementId,
      folderId: _folderId,
      isPrimary: _isPrimary,
      referenceKind: _referenceKind,
      referenceMetadata: _referenceMetadata,
      role: _role,
      sortOrder: _sortOrder,
      validateFlowReferenceBudgets: _validateFlowReferenceBudgets,
      ...assetInput
    } = input
    const asset = await trx.insertInto('assets')
      .values({
        ...assetInput,
        folderId,
        source: 'upload',
        processingState: 'processing',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    if (input.elementId && input.role && preparedLink?.status === 'prepared') {
      await insertPreparedElementAssetAttachment(trx, {
        assetId: asset.id,
        elementId: input.elementId,
        organizationId: input.organizationId,
        prepared: preparedLink,
        sortOrder: input.sortOrder,
        validateFlowReferenceBudgets: input.validateFlowReferenceBudgets,
      })
    }

    return { asset, status: 'created' as const }
  })
}

export async function updateAssetRow(input: {
  folderId?: null | string
  id: string
  name?: string
  organizationId: string
}) {
  return db.updateTable('assets')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.id)
    .where('purgeRequestedAt', 'is', null)
    .returningAll()
    .executeTakeFirst()
}

export type MoveAssetRowsResult
  = | { assets: AssetRecord[], status: 'moved' }
    | { field?: 'assetIds' | 'folderId', status: 'not_found' }
    | { status: 'invalid_state' }

export function moveAssetRows(input: {
  assetIds: string[]
  folderId: null | string
  organizationId: string
}): Promise<MoveAssetRowsResult> {
  return db.transaction().execute(async (trx) => {
    const assets = await trx.selectFrom('assets')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', 'in', input.assetIds)
      .forUpdate()
      .execute()

    if (assets.length !== input.assetIds.length)
      return { field: 'assetIds', status: 'not_found' }

    if (assets.some(asset => asset.purgeRequestedAt || asset.purgedAt))
      return { status: 'invalid_state' }

    if (input.folderId) {
      const folder = await trx.selectFrom('folders')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.folderId)
        .executeTakeFirst()

      if (!folder)
        return { field: 'folderId', status: 'not_found' }
    }

    const updated = await trx.updateTable('assets')
      .set({ folderId: input.folderId, updatedAt: new Date() })
      .where('organizationId', '=', input.organizationId)
      .where('id', 'in', input.assetIds)
      .where('purgeRequestedAt', 'is', null)
      .returningAll()
      .execute()

    if (updated.length !== input.assetIds.length)
      return { status: 'invalid_state' }

    const byId = new Map(updated.map(asset => [asset.id, asset]))
    return {
      assets: input.assetIds.map(id => byId.get(id)!),
      status: 'moved',
    }
  })
}

export async function archiveAssetRow(organizationId: string, id: string) {
  return db.updateTable('assets')
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .where('purgeRequestedAt', 'is', null)
    .returning('id')
    .executeTakeFirst()
}

export async function restoreAssetRow(organizationId: string, id: string) {
  return db.updateTable('assets')
    .set({ deletedAt: null, updatedAt: new Date() })
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .where('purgeRequestedAt', 'is', null)
    .returningAll()
    .executeTakeFirst()
}

export type PurgeRequestResult
  = | { asset: AssetRecord, status: 'already_requested' | 'requested' }
    | { status: 'active_generation' }
    | { status: 'not_found' }

export async function requestAssetPurgeInTransaction(
  trx: Transaction<Database>,
  organizationId: string,
  id: string,
): Promise<PurgeRequestResult> {
  const asset = await trx.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst()

  if (!asset)
    return { status: 'not_found' }

  if (asset.purgeRequestedAt)
    return { asset, status: 'already_requested' }

  const activeGeneration = await trx.selectFrom('generationJobInputs as input')
    .innerJoin('generationJobs as job', join => join
      .onRef('job.id', '=', 'input.jobId')
      .onRef('job.organizationId', '=', 'input.organizationId'))
    .select('input.assetId')
    .where('input.organizationId', '=', organizationId)
    .where('input.assetId', '=', id)
    .where('job.status', 'in', ['pending', 'running'])
    .executeTakeFirst()

  if (activeGeneration)
    return { status: 'active_generation' }

  const now = new Date()
  const updated = await trx.updateTable('assets')
    .set({
      deletedAt: asset.deletedAt ?? now,
      purgeRequestedAt: now,
      updatedAt: now,
    })
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()

  return { asset: updated, status: 'requested' }
}

export async function requestAssetPurge(
  organizationId: string,
  id: string,
): Promise<PurgeRequestResult> {
  return db.transaction().execute(trx => (
    requestAssetPurgeInTransaction(trx, organizationId, id)
  ))
}

export async function getAssetDetailRelations(
  organizationId: string,
  asset: AssetRecord,
) {
  const [elementLinks, usedAsInput, generation] = await Promise.all([
    db.selectFrom('elementAssets as link')
      .innerJoin('elements as element', join => join
        .onRef('element.id', '=', 'link.elementId')
        .onRef('element.organizationId', '=', 'link.organizationId'))
      .select([
        'link.elementId',
        'link.role',
        'link.isPrimary',
        'link.referenceKind',
        'link.referenceMetadata',
        'element.type as elementType',
        'element.data as elementData',
        'element.schemaVersion as elementSchemaVersion',
      ])
      .where('link.organizationId', '=', organizationId)
      .where('link.assetId', '=', asset.id)
      .execute(),
    db.selectFrom('generationJobInputs')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('organizationId', '=', organizationId)
      .where('assetId', '=', asset.id)
      .executeTakeFirstOrThrow(),
    asset.generationJobId
      ? getGenerationProvenance(organizationId, asset.generationJobId)
      : Promise.resolve(null),
  ])

  return {
    elementLinks,
    generation,
    usedAsInputCount: Number(usedAsInput.count),
  }
}

async function getGenerationProvenance(organizationId: string, jobId: string) {
  const job = await db.selectFrom('generationJobs')
    .select([
      'id',
      'flowRunId',
      'mediaType',
      'provider',
      'model',
      'settings',
      'resolvedPrompt',
      'creditCost',
      'createdAt',
      'completedAt',
    ])
    .where('organizationId', '=', organizationId)
    .where('id', '=', jobId)
    .executeTakeFirst()

  if (!job)
    return null

  const [sources, inputs] = await Promise.all([
    db.selectFrom('generationJobSources')
      .select([
        'sortOrder',
        'sourceType',
        'nodeId',
        'elementId',
        'assetId',
        'resolvedText',
        'snapshot',
      ])
      .where('organizationId', '=', organizationId)
      .where('jobId', '=', jobId)
      .orderBy('sortOrder')
      .execute(),
    db.selectFrom('generationJobInputs')
      .select(['assetId', 'role', 'sortOrder'])
      .where('organizationId', '=', organizationId)
      .where('jobId', '=', jobId)
      .orderBy('sortOrder')
      .execute(),
  ])

  return { job, sources, inputs }
}

export async function listAssetUsageRows(input: {
  assetId: string
  cursor: PageCursor<'createdAt'> | null
  limit: number
  organizationId: string
}) {
  let query = db.selectFrom('generationJobInputs as input')
    .innerJoin('generationJobs as job', join => join
      .onRef('job.id', '=', 'input.jobId')
      .onRef('job.organizationId', '=', 'input.organizationId'))
    .select([
      'job.id as jobId',
      'job.flowRunId as runId',
      'input.role',
      'job.createdAt',
    ])
    .where('input.organizationId', '=', input.organizationId)
    .where('input.assetId', '=', input.assetId)

  if (input.cursor) {
    const value = new Date(String(input.cursor.sortValue))
    query = query.where(eb => eb.or([
      eb('job.createdAt', '<', value),
      eb.and([
        eb('job.createdAt', '=', value),
        eb('job.id', '<', input.cursor!.id),
      ]),
    ]))
  }

  return query
    .orderBy('job.createdAt', 'desc')
    .orderBy('job.id', 'desc')
    .limit(input.limit + 1)
    .execute()
}

export function markAssetProcessingFailed(input: {
  assetId: string
  error: string
  organizationId: string
}) {
  return db.updateTable('assets')
    .set({
      processingState: 'failed',
      processingError: input.error,
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.assetId)
    .where('processingState', '=', 'processing')
    .where('purgeRequestedAt', 'is', null)
    .executeTakeFirst()
}

export function markAssetProcessingReady(input: {
  assetId: string
  durationSeconds: null | number
  height: null | number
  metadata: JsonValue
  organizationId: string
  thumbnailKey: null | string
  width: null | number
}) {
  return db.updateTable('assets')
    .set({
      durationSeconds: input.durationSeconds,
      height: input.height,
      metadata: input.metadata,
      processingError: null,
      processingState: 'ready',
      thumbnailKey: input.thumbnailKey,
      updatedAt: new Date(),
      width: input.width,
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.assetId)
    .where('processingState', '=', 'processing')
    .where('purgeRequestedAt', 'is', null)
    .executeTakeFirst()
}

export function listAssetsAwaitingIngestion(olderThan: Date, limit = 100) {
  return db.selectFrom('assets')
    .select(['id', 'organizationId'])
    .where('processingState', '=', 'processing')
    .where('purgeRequestedAt', 'is', null)
    .where('createdAt', '<', olderThan)
    .orderBy('createdAt')
    .limit(limit)
    .execute()
}

export function listAssetsAwaitingPurge(olderThan: Date, limit = 100) {
  return db.selectFrom('assets')
    .select(['id', 'organizationId'])
    .where('purgeRequestedAt', 'is not', null)
    .where('purgedAt', 'is', null)
    .where('purgeRequestedAt', '<', olderThan)
    .orderBy('purgeRequestedAt')
    .limit(limit)
    .execute()
}

export async function completeAssetPurge(input: {
  assetId: string
  organizationId: string
}) {
  return db.updateTable('assets')
    .set({ purgedAt: new Date(), updatedAt: new Date() })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.assetId)
    .where('purgeRequestedAt', 'is not', null)
    .where('purgedAt', 'is', null)
    .executeTakeFirst()
}

export async function withAssetTransaction<T>(
  callback: (transaction: Transaction<Database>) => Promise<T>,
) {
  return db.transaction().execute(callback)
}
