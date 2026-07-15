import type { ElementTable, JsonValue } from '@talelabs/db'
import type { ElementReferenceKind } from '@talelabs/elements'
import type { Selectable } from 'kysely'
import type { PageCursor } from '../pagination/cursor.js'

import { db, sql } from '@talelabs/db'
import { provisionElementAssetFolderRow } from './folders.data.js'

export type ElementRecord = Selectable<ElementTable>
export type ElementListRow = ElementRecord

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

export async function listElementRows(input: {
  cursor: PageCursor<'updatedAt'> | null
  limit: number
  organizationId: string
  search?: string
  type?: string
}) {
  let query = db.selectFrom('elements')
    .selectAll()
    .where('organizationId', '=', input.organizationId)

  if (input.type)
    query = query.where('type', '=', input.type)

  if (input.search) {
    query = query.where(
      sql<boolean>`"name" ilike ${`%${escapeLike(input.search)}%`} escape '\\'`,
    )
  }

  if (input.cursor) {
    const updatedAt = new Date(String(input.cursor.sortValue))
    query = query.where(eb => eb.or([
      eb('updatedAt', '<', updatedAt),
      eb.and([
        eb('updatedAt', '=', updatedAt),
        eb('id', '<', input.cursor!.id),
      ]),
    ]))
  }

  return query
    .orderBy('updatedAt', 'desc')
    .orderBy('id', 'desc')
    .limit(input.limit + 1)
    .execute()
}

export function findElementById(organizationId: string, id: string) {
  return db.selectFrom('elements')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

export function insertElementWithAssetFolderRow(input: {
  createdBy: string
  data: JsonValue
  id: string
  instructions: null | string
  name: string
  organizationId: string
  schemaVersion: number
  type: string
}) {
  return db.transaction().execute(async (trx) => {
    const provisioned = await provisionElementAssetFolderRow(trx, {
      elementName: input.name,
      organizationId: input.organizationId,
    })
    if (provisioned.status !== 'provisioned')
      return provisioned

    const element = await trx.insertInto('elements')
      .values({ ...input, assetFolderId: provisioned.folderId })
      .returningAll()
      .executeTakeFirstOrThrow()
    return { element, status: 'created' as const }
  })
}

export function updateElementRow(input: {
  id: string
  organizationId: string
  prepare: (
    element: ElementRecord,
    linkedRoles: Array<{ count: number, role: string }>,
  ) => {
    data?: JsonValue
    instructions?: null | string
    name?: string
    schemaVersion?: number
  }
}) {
  return db.transaction().execute(async (trx) => {
    const element = await trx.selectFrom('elements')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (!element)
      return undefined

    const linkedRoles = await trx.selectFrom('elementAssets')
      .select(({ fn }) => [
        'role',
        fn.countAll<number>().as('count'),
      ])
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.id)
      .groupBy('role')
      .execute()
    const update = input.prepare(element, linkedRoles.map(link => ({
      count: Number(link.count),
      role: link.role,
    })))

    return trx.updateTable('elements')
      .set({
        ...(update.data !== undefined ? { data: update.data } : {}),
        ...(update.instructions !== undefined
          ? { instructions: update.instructions }
          : {}),
        ...(update.name !== undefined ? { name: update.name } : {}),
        ...(update.schemaVersion !== undefined
          ? { schemaVersion: update.schemaVersion }
          : {}),
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow()
  })
}

export function deleteElementRow(organizationId: string, id: string) {
  return db.deleteFrom('elements')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst()
}

export function countElementAssetsByRole(organizationId: string, elementId: string) {
  return db.selectFrom('elementAssets')
    .select(({ fn }) => [
      'role',
      fn.countAll<number>().as('count'),
    ])
    .where('organizationId', '=', organizationId)
    .where('elementId', '=', elementId)
    .where('referenceKind', '=', 'master')
    .groupBy('role')
    .execute()
}

export function listElementPreviewAssets(input: {
  elementIds: string[]
  organizationId: string
  previewRoles: Readonly<Record<string, null | string>>
}) {
  if (input.elementIds.length === 0)
    return Promise.resolve([])

  const fixedRoles = Object.entries(input.previewRoles)
    .filter((entry): entry is [string, string] => entry[1] !== null)
  const customRoleTypes = Object.entries(input.previewRoles)
    .filter(([, role]) => role === null)
    .map(([type]) => type)
  const roleCases = fixedRoles.map(([type, role]) =>
    sql`when e."type" = ${type} then ${role}`)
  const fixedRoleCondition = roleCases.length
    ? sql`ea."role" = case ${sql.join(roleCases, sql` `)} else '' end`
    : sql`false`
  const customRoleCondition = customRoleTypes.length
    ? sql`e."type" in (${sql.join(customRoleTypes.map(type => sql`${type}`))})`
    : sql`false`
  const preferredRoleCondition = sql`(
    ${fixedRoleCondition} or ${customRoleCondition}
  )`

  return sql<{
    elementId: string
    mimeType: string
    storageKey: string
    thumbnailKey: null | string
    type: 'audio' | 'document' | 'image' | 'video'
    visibility: 'private' | 'public'
  }>`
    select distinct on (e."id")
      e."id" as "elementId",
      a."mimeType",
      a."storageKey",
      a."thumbnailKey",
      a."type",
      a."visibility"
    from "elements" e
    join "elementAssets" ea
      on ea."organizationId" = e."organizationId"
      and ea."elementId" = e."id"
    join "assets" a
      on a."organizationId" = e."organizationId"
      and a."id" = ea."assetId"
      and a."processingState" = 'ready'
      and a."purgeRequestedAt" is null
      -- Archived references remain eligible while they are linked. Archiving
      -- organizes the Asset library; it does not invalidate Element context.
      and (a."type" = 'image' or a."thumbnailKey" is not null)
    where e."organizationId" = ${input.organizationId}
      and e."id" in (${sql.join(input.elementIds.map(id => sql`${id}`))})
      and ea."referenceKind" = 'master'
    order by
      e."id",
      case when ea."isPrimary" then 0 else 1 end,
      case when ${preferredRoleCondition} then 0 else 1 end,
      ea."role",
      ea."sortOrder",
      ea."assetId"
  `.execute(db).then(result => result.rows)
}

export function listElementAssetRows(input: {
  elementId: string
  organizationId: string
  referenceKind?: ElementReferenceKind
  role?: string
}) {
  let query = db.selectFrom('elementAssets as link')
    .innerJoin('assets as asset', join => join
      .onRef('asset.id', '=', 'link.assetId')
      .onRef('asset.organizationId', '=', 'link.organizationId'))
    .select([
      'link.assetId',
      'link.role',
      'link.sortOrder',
      'link.isPrimary',
      'link.referenceKind',
      'link.referenceMetadata',
      'asset.id as id',
      'asset.organizationId',
      'asset.createdBy',
      'asset.name',
      'asset.type',
      'asset.source',
      'asset.visibility',
      'asset.storageKey',
      'asset.thumbnailKey',
      'asset.mimeType',
      'asset.sizeBytes',
      'asset.width',
      'asset.height',
      'asset.durationSeconds',
      'asset.folderId',
      'asset.generationJobId',
      'asset.outputIndex',
      'asset.uploadId',
      'asset.metadata',
      'asset.processingState',
      'asset.processingError',
      'asset.createdAt',
      'asset.updatedAt',
      'asset.deletedAt',
      'asset.purgeRequestedAt',
      'asset.purgedAt',
    ])
    .where('link.organizationId', '=', input.organizationId)
    .where('link.elementId', '=', input.elementId)

  if (input.role)
    query = query.where('link.role', '=', input.role)
  if (input.referenceKind)
    query = query.where('link.referenceKind', '=', input.referenceKind)

  return query
    .orderBy('link.role')
    .orderBy('link.referenceKind')
    .orderBy('link.sortOrder')
    .orderBy('link.assetId')
    .execute()
}

export function listUsableElementContextAssetRows(input: {
  elementId: string
  organizationId: string
}) {
  return db.selectFrom('elementAssets as link')
    .innerJoin('assets as asset', join => join
      .onRef('asset.id', '=', 'link.assetId')
      .onRef('asset.organizationId', '=', 'link.organizationId'))
    .select([
      'link.assetId',
      'link.role',
      'link.sortOrder',
      'link.isPrimary',
      'link.referenceMetadata',
      'asset.type as mediaType',
      'asset.mimeType',
    ])
    .where('link.organizationId', '=', input.organizationId)
    .where('link.elementId', '=', input.elementId)
    .where('link.referenceKind', '=', 'master')
    .where('asset.processingState', '=', 'ready')
    .where('asset.purgeRequestedAt', 'is', null)
    .where('asset.purgedAt', 'is', null)
    .where('asset.type', 'in', ['image', 'video', 'audio'])
    .execute()
}

/**
 * Batch-loads eligible masters for derived readiness and pending-state
 * observation without per-Element reads.
 */
export function listElementReadinessRows(input: {
  elementIds: readonly string[]
  organizationId: string
}) {
  if (input.elementIds.length === 0)
    return Promise.resolve([])

  return db.selectFrom('elementAssets as link')
    .innerJoin('assets as asset', join => join
      .onRef('asset.id', '=', 'link.assetId')
      .onRef('asset.organizationId', '=', 'link.organizationId'))
    .select([
      'link.elementId',
      'link.referenceKind',
      'link.referenceMetadata',
      'link.role',
      'asset.processingState',
    ])
    .where('link.organizationId', '=', input.organizationId)
    .where('link.elementId', 'in', [...input.elementIds])
    .where('link.referenceKind', '=', 'master')
    .where('asset.processingState', 'in', ['processing', 'ready'])
    .where('asset.purgeRequestedAt', 'is', null)
    .where('asset.purgedAt', 'is', null)
    .where('asset.type', 'in', ['image', 'video', 'audio'])
    .execute()
}

export async function getElementUsageRows(organizationId: string, elementId: string) {
  const runSummary = await db.selectFrom('generationJobSources as source')
    .innerJoin('generationJobs as job', join => join
      .onRef('job.id', '=', 'source.jobId')
      .onRef('job.organizationId', '=', 'source.organizationId'))
    .select(({ fn }) => [
      fn.count<number>('source.jobId').distinct().as('count'),
      fn.max<Date>('job.createdAt').as('lastUsedAt'),
    ])
    .where('source.organizationId', '=', organizationId)
    .where('source.elementId', '=', elementId)
    .executeTakeFirstOrThrow()

  // Elements are dormant and no longer participate in active Flow graphs.
  return {
    flowSummary: { count: 0 },
    flows: [] as Array<{
      flowId: string
      flowName: string
      nodeCount: number
    }>,
    runSummary,
  }
}
