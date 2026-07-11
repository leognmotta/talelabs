import type { Database, ElementTable, JsonValue } from '@talelabs/db'
import type { Selectable, Transaction } from 'kysely'
import type { PageCursor } from '../pagination/cursor.js'

import { db, sql } from '@talelabs/db'
import { getStoredElementAssetRole } from '../domain/elements/stored-element-asset-role.js'
import {
  findElementAssetRoleCapacityViolation,
  lockElementAssetRole,
} from './element-asset-limits.data.js'
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
  }>`
    select distinct on (e."id")
      e."id" as "elementId",
      a."mimeType",
      a."storageKey",
      a."thumbnailKey",
      a."type"
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
    order by
      e."id",
      case when ${preferredRoleCondition} then 0 else 1 end,
      case when ea."isPrimary" then 0 else 1 end,
      ea."role",
      ea."sortOrder",
      ea."assetId"
  `.execute(db).then(result => result.rows)
}

export function listElementAssetRows(input: {
  elementId: string
  organizationId: string
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
      'asset.id as id',
      'asset.organizationId',
      'asset.createdBy',
      'asset.name',
      'asset.type',
      'asset.source',
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

  return query
    .orderBy('link.role')
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
      'asset.type as mediaType',
      'asset.mimeType',
    ])
    .where('link.organizationId', '=', input.organizationId)
    .where('link.elementId', '=', input.elementId)
    .where('asset.processingState', '=', 'ready')
    .where('asset.purgeRequestedAt', 'is', null)
    .where('asset.purgedAt', 'is', null)
    .where('asset.type', 'in', ['image', 'video', 'audio'])
    .execute()
}

async function normalizeRoleOrder(
  trx: Transaction<Database>,
  input: { elementId: string, organizationId: string, role: string },
) {
  const links = await trx.selectFrom('elementAssets')
    .select(['assetId', 'sortOrder'])
    .where('organizationId', '=', input.organizationId)
    .where('elementId', '=', input.elementId)
    .where('role', '=', input.role)
    .orderBy('sortOrder')
    .orderBy('assetId')
    .execute()

  for (const [index, link] of links.entries()) {
    await trx.updateTable('elementAssets')
      .set({ sortOrder: index })
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', link.assetId)
      .where('role', '=', input.role)
      .execute()
  }
}

export type CreateElementAssetLinkResult
  = | { status: 'asset_not_available' | 'asset_not_found' | 'element_not_found' }
    | {
      mediaType: 'audio' | 'document' | 'image' | 'video'
      status: 'incompatible_asset'
    }
    | { status: 'role_not_found' }
    | {
      status: 'element_asset_role_capacity_reached'
      maximum: number
      role: string
    }
    | { status: 'conflict' }
    | { status: 'created', assetId: string, isPrimary: boolean, role: string, sortOrder: number }

export function createElementAssetLinkRow(input: {
  assetId: string
  elementId: string
  isPrimary: boolean
  organizationId: string
  role: string
  sortOrder?: number
}): Promise<CreateElementAssetLinkResult> {
  return db.transaction().execute(async (trx) => {
    const element = await trx.selectFrom('elements')
      .select(['data', 'id', 'schemaVersion', 'type'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.elementId)
      .forUpdate()
      .executeTakeFirst()
    if (!element)
      return { status: 'element_not_found' }

    const role = getStoredElementAssetRole(element, input.role)
    if (!role)
      return { status: 'role_not_found' }

    await lockElementAssetRole(trx, {
      elementId: input.elementId,
      organizationId: input.organizationId,
      role: input.role,
    })

    const asset = await trx.selectFrom('assets')
      .select(['deletedAt', 'id', 'type', 'purgeRequestedAt'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.assetId)
      .executeTakeFirst()
    if (!asset)
      return { status: 'asset_not_found' }
    if (asset.deletedAt || asset.purgeRequestedAt)
      return { status: 'asset_not_available' }
    if (asset.type === 'document' || !role.accepts.includes(asset.type))
      return { mediaType: asset.type, status: 'incompatible_asset' }

    const duplicate = await trx.selectFrom('elementAssets')
      .select('assetId')
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', input.role)
      .executeTakeFirst()
    if (duplicate)
      return { status: 'conflict' }

    const limitViolation = await findElementAssetRoleCapacityViolation(trx, {
      elementId: input.elementId,
      maximum: role.maxAssets,
      organizationId: input.organizationId,
      role: input.role,
    })
    if (limitViolation) {
      return {
        ...limitViolation,
        status: 'element_asset_role_capacity_reached',
      }
    }

    const existing = await trx.selectFrom('elementAssets')
      .select(['assetId', 'sortOrder'])
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('role', '=', input.role)
      .orderBy('sortOrder')
      .orderBy('assetId')
      .execute()
    const targetOrder = Math.max(0, Math.min(input.sortOrder ?? existing.length, existing.length))

    if (input.isPrimary) {
      await trx.updateTable('elementAssets')
        .set({ isPrimary: false })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('role', '=', input.role)
        .execute()
    }

    await trx.updateTable('elementAssets')
      .set({ sortOrder: sql`"sortOrder" + 1` })
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('role', '=', input.role)
      .where('sortOrder', '>=', targetOrder)
      .execute()
    await trx.insertInto('elementAssets').values({
      assetId: input.assetId,
      elementId: input.elementId,
      isPrimary: input.isPrimary,
      organizationId: input.organizationId,
      role: input.role,
      sortOrder: targetOrder,
    }).execute()

    return {
      assetId: input.assetId,
      isPrimary: input.isPrimary,
      role: input.role,
      sortOrder: targetOrder,
      status: 'created',
    }
  })
}

export type UpdateElementAssetLinkResult
  = | { status: 'element_not_found' | 'link_not_found' }
    | { status: 'updated', assetId: string, isPrimary: boolean, role: string, sortOrder: number }

export function updateElementAssetLinkRow(input: {
  assetId: string
  elementId: string
  isPrimary?: boolean
  organizationId: string
  role: string
  sortOrder?: number
}): Promise<UpdateElementAssetLinkResult> {
  return db.transaction().execute(async (trx) => {
    const element = await trx.selectFrom('elements')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.elementId)
      .forUpdate()
      .executeTakeFirst()
    if (!element)
      return { status: 'element_not_found' }

    const current = await trx.selectFrom('elementAssets')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', input.role)
      .executeTakeFirst()
    if (!current)
      return { status: 'link_not_found' }

    if (input.sortOrder !== undefined && input.sortOrder !== current.sortOrder) {
      const count = await trx.selectFrom('elementAssets')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('role', '=', input.role)
        .executeTakeFirstOrThrow()
      const target = Math.max(0, Math.min(input.sortOrder, Number(count.count) - 1))

      await trx.updateTable('elementAssets')
        .set({ sortOrder: -1 })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('assetId', '=', input.assetId)
        .where('role', '=', input.role)
        .execute()

      if (target < current.sortOrder) {
        await trx.updateTable('elementAssets')
          .set({ sortOrder: sql`"sortOrder" + 1` })
          .where('organizationId', '=', input.organizationId)
          .where('elementId', '=', input.elementId)
          .where('role', '=', input.role)
          .where('sortOrder', '>=', target)
          .where('sortOrder', '<', current.sortOrder)
          .execute()
      }
      else {
        await trx.updateTable('elementAssets')
          .set({ sortOrder: sql`"sortOrder" - 1` })
          .where('organizationId', '=', input.organizationId)
          .where('elementId', '=', input.elementId)
          .where('role', '=', input.role)
          .where('sortOrder', '>', current.sortOrder)
          .where('sortOrder', '<=', target)
          .execute()
      }

      await trx.updateTable('elementAssets')
        .set({ sortOrder: target })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('assetId', '=', input.assetId)
        .where('role', '=', input.role)
        .execute()
    }

    if (input.isPrimary === true) {
      await trx.updateTable('elementAssets')
        .set({ isPrimary: false })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('role', '=', input.role)
        .execute()
    }

    if (input.isPrimary !== undefined) {
      await trx.updateTable('elementAssets')
        .set({ isPrimary: input.isPrimary })
        .where('organizationId', '=', input.organizationId)
        .where('elementId', '=', input.elementId)
        .where('assetId', '=', input.assetId)
        .where('role', '=', input.role)
        .execute()
    }

    await normalizeRoleOrder(trx, input)
    const updated = await trx.selectFrom('elementAssets')
      .select(['assetId', 'isPrimary', 'role', 'sortOrder'])
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', input.role)
      .executeTakeFirstOrThrow()
    return { ...updated, status: 'updated' }
  })
}

export function deleteElementAssetLinkRow(input: {
  assetId: string
  elementId: string
  organizationId: string
  role: string
}) {
  return db.transaction().execute(async (trx) => {
    const element = await trx.selectFrom('elements')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.elementId)
      .forUpdate()
      .executeTakeFirst()
    if (!element)
      return false

    const deleted = await trx.deleteFrom('elementAssets')
      .where('organizationId', '=', input.organizationId)
      .where('elementId', '=', input.elementId)
      .where('assetId', '=', input.assetId)
      .where('role', '=', input.role)
      .returning('assetId')
      .executeTakeFirst()
    if (!deleted)
      return false

    await normalizeRoleOrder(trx, input)
    return true
  })
}

export async function getElementUsageRows(organizationId: string, elementId: string) {
  const [flowSummary, flows, runSummary] = await Promise.all([
    db.selectFrom('flowNodes')
      .select(({ fn }) => fn.count<number>('flowId').distinct().as('count'))
      .where('organizationId', '=', organizationId)
      .where('elementId', '=', elementId)
      .executeTakeFirstOrThrow(),
    db.selectFrom('flowNodes as node')
      .innerJoin('flows as flow', join => join
        .onRef('flow.id', '=', 'node.flowId')
        .onRef('flow.organizationId', '=', 'node.organizationId'))
      .select(({ fn }) => [
        'flow.id as flowId',
        'flow.name as flowName',
        'flow.updatedAt',
        fn.countAll<number>().as('nodeCount'),
      ])
      .where('node.organizationId', '=', organizationId)
      .where('node.elementId', '=', elementId)
      .groupBy(['flow.id', 'flow.name', 'flow.updatedAt'])
      .orderBy('flow.updatedAt', 'desc')
      .orderBy('flow.id', 'desc')
      .limit(20)
      .execute(),
    db.selectFrom('generationJobSources as source')
      .innerJoin('generationJobs as job', join => join
        .onRef('job.id', '=', 'source.jobId')
        .onRef('job.organizationId', '=', 'source.organizationId'))
      .select(({ fn }) => [
        fn.count<number>('source.jobId').distinct().as('count'),
        fn.max<Date>('job.createdAt').as('lastUsedAt'),
      ])
      .where('source.organizationId', '=', organizationId)
      .where('source.elementId', '=', elementId)
      .executeTakeFirstOrThrow(),
  ])

  return { flowSummary, flows, runSummary }
}
