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
  generatedByCreateSessionId?: string
  generatedByFlowId?: string
  limit: number
  order: SortOrder
  organizationId: string
  projectId?: null | string
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

  if (input.projectId === null)
    conditions.push(sql<boolean>`a."projectId" is null`)
  else if (input.projectId !== undefined)
    conditions.push(sql<boolean>`a."projectId" = ${input.projectId}`)

  if (input.generatedByFlowId) {
    conditions.push(sql<boolean>`exists (
      select 1 from "generationJobs" generated_job
      where generated_job."organizationId" = ${input.organizationId}
        and generated_job."id" = a."generationJobId"
        and generated_job."flowId" = ${input.generatedByFlowId}
    )`)
  }

  if (input.generatedByCreateSessionId) {
    conditions.push(sql<boolean>`exists (
      select 1
      from "generationJobs" generated_job
      join "flowRuns" generated_run
        on generated_run."organizationId" = generated_job."organizationId"
        and generated_run."id" = generated_job."flowRunId"
      where generated_job."organizationId" = ${input.organizationId}
        and generated_job."id" = a."generationJobId"
        and generated_run."createSessionId"
          = ${input.generatedByCreateSessionId}
    )`)
  }

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
