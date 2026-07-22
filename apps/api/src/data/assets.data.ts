/** Kysely data access for Assets: library queries, lifecycle, and purge. */

import type {
  AssetSource,
  AssetTable,
  AssetType,
  Database,
  JsonValue,
} from '@talelabs/db'
import type { Selectable, Transaction } from 'kysely'
import type { PageCursor, SortOrder } from '../pagination/cursor.js'

import { db, sql } from '@talelabs/db'

/** One persisted Asset row. */
export type AssetRecord = Selectable<AssetTable>
/** Asset list row with its case-insensitive name sort key. */
export type AssetListRow = AssetRecord & { nameSortValue: string }
/** Sortable Asset list columns. */
export type AssetSort = 'createdAt' | 'name' | 'sizeBytes'

/** Filters, cursor, and page size for the Asset library query. */
export interface ListAssetRowsInput {
  archived: boolean
  cursor: PageCursor<AssetSort> | null
  elementId?: string
  favorite?: boolean
  folderId?: 'root' | string
  limit: number
  order: SortOrder
  organizationId: string
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

/** Lists Asset rows for the library, `limit + 1` for paging. */
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
      select 1 from "elementReferences" reference
      where reference."organizationId" = ${input.organizationId}
        and reference."elementId" = ${input.elementId}
        and reference."assetId" = a."id"
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

/** Loads one tenant-scoped Asset row, or undefined. */
export function findAssetById(organizationId: string, id: string) {
  return db.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

/** Loads the Asset registered for one upload, or undefined. */
export function findAssetByUploadId(organizationId: string, uploadId: string) {
  return db.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('uploadId', '=', uploadId)
    .executeTakeFirst()
}

/** Confirms a tenant-scoped folder exists. */
export function findFolderById(organizationId: string, id: string) {
  return db.selectFrom('folders')
    .select(['id'])
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

/** Registers one uploaded Asset in the processing state. */
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
}) {
  return db.transaction().execute(async (trx) => {
    const asset = await trx.insertInto('assets')
      .values({
        ...input,
        source: 'upload',
        visibility: 'private',
        processingState: 'processing',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return { asset, status: 'created' as const }
  })
}

/** Updates name/folder of one Asset unless it is being purged. */
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

/** Outcome of the transactional bulk move. */
export type MoveAssetRowsResult
  = | { assets: AssetRecord[], status: 'moved' }
    | { field?: 'assetIds' | 'folderId', status: 'not_found' }
    | { status: 'invalid_state' }

/** Moves Assets into a folder transactionally, rejecting purging rows. */
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

/** Archives one Asset (reversible) unless it is being purged. */
export async function archiveAssetRow(organizationId: string, id: string) {
  return db.updateTable('assets')
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .where('purgeRequestedAt', 'is', null)
    .returning('id')
    .executeTakeFirst()
}

/** Un-archives one Asset; guarded against purge-in-progress. */
export async function restoreAssetRow(organizationId: string, id: string) {
  return db.updateTable('assets')
    .set({ deletedAt: null, updatedAt: new Date() })
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .where('purgeRequestedAt', 'is', null)
    .returningAll()
    .executeTakeFirst()
}

/** Outcome of requesting a permanent Asset purge. */
export type PurgeRequestResult
  = | { asset: AssetRecord, status: 'already_requested' | 'requested' }
    | { status: 'active_generation' }
    | { status: 'not_found' }

/**
 * Marks one Asset for permanent purge inside `trx`: archives it, rejects if
 * an active generation consumes it, and detaches it from every Element.
 */
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

  // Purged Assets are tombstoned, not row-deleted, so the Element reference
  // FK cascade never fires; detach them here or they linger in Elements.
  // Lock the affected Element rows (id order) BEFORE deleting reference rows,
  // so purge and Element reference mutation share one global lock order —
  // Asset → Element → elementReferences — and can never deadlock. The Asset
  // is already locked, so no new reference to it can appear meanwhile.
  const referencingRows = await trx.selectFrom('elementReferences')
    .select('elementId')
    .where('organizationId', '=', organizationId)
    .where('assetId', '=', id)
    .execute()
  const affectedElementIds = [...new Set(referencingRows.map(r => r.elementId))]
    .sort()

  if (affectedElementIds.length > 0) {
    await trx.selectFrom('elements')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('id', 'in', affectedElementIds)
      .orderBy('id')
      .forUpdate()
      .execute()

    await trx.deleteFrom('elementReferences')
      .where('organizationId', '=', organizationId)
      .where('assetId', '=', id)
      .execute()

    await trx.updateTable('elements')
      .set({ updatedAt: now })
      .where('organizationId', '=', organizationId)
      .where('id', 'in', affectedElementIds)
      .execute()
  }

  return { asset: updated, status: 'requested' }
}

/** Requests a purge in its own transaction. */
export async function requestAssetPurge(
  organizationId: string,
  id: string,
): Promise<PurgeRequestResult> {
  return db.transaction().execute(trx => (
    requestAssetPurgeInTransaction(trx, organizationId, id)
  ))
}

/** Loads the provenance and usage relations for one Asset detail. */
export async function getAssetDetailRelations(
  organizationId: string,
  asset: AssetRecord,
) {
  const [usedAsInput, generation] = await Promise.all([
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

/** Pages the Flows and jobs that reference one Asset. */
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
    .distinct()
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

/** Records a processing failure with its error code. */
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

/** Marks processing complete with measured media metadata. */
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

/** Finds stale processing Assets for the ingestion sweep. */
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

/** Finds stale purge-requested Assets for the purge sweep. */
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

/** Stamps `purgedAt` after storage deletion actually succeeded. */
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

/** Runs `fn` inside one database transaction. */
export async function withAssetTransaction<T>(
  callback: (transaction: Transaction<Database>) => Promise<T>,
) {
  return db.transaction().execute(callback)
}
