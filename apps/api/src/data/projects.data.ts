/** Kysely persistence for Project CRUD, counts, covers, and cursor lists. */

import type { AssetTable, ProjectTable } from '@talelabs/db'
import type { Selectable } from 'kysely'
import type { PageCursor } from '../pagination/cursor.js'

import { db, sql } from '@talelabs/db'
import { lockProjectScopes } from '../domain/projects/project-scope.js'

/** One persisted Project row. */
export type ProjectRecord = Selectable<ProjectTable>

/** One Project row with grouped sidebar/list counts. */
export type ProjectSummaryRow = ProjectRecord & {
  assetCount: number
  createSessionCount: number
  elementCount: number
  flowCount: number
  folderCount: number
}

/** One cover Asset loaded in a bounded batch. */
export type ProjectCoverAssetRow = Selectable<AssetTable>

/** Active/archive filters supported by the Project list. */
export type ProjectArchiveFilter = 'active' | 'all' | 'archived'

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

function projectConditions(input: {
  archive: ProjectArchiveFilter
  cursor?: PageCursor<'updatedAt'> | null
  id?: string
  organizationId: string
  search?: string
}) {
  const conditions = [
    sql<boolean>`project."organizationId" = ${input.organizationId}`,
  ]
  if (input.id)
    conditions.push(sql<boolean>`project."id" = ${input.id}`)
  if (input.archive === 'active')
    conditions.push(sql<boolean>`project."archivedAt" is null`)
  if (input.archive === 'archived')
    conditions.push(sql<boolean>`project."archivedAt" is not null`)
  if (input.search) {
    const pattern = `%${escapeLike(input.search)}%`
    conditions.push(sql<boolean>`
      lower(project."name" || ' ' || project."description")
        like lower(${pattern}) escape '\\'
    `)
  }
  if (input.cursor) {
    const value = new Date(String(input.cursor.sortValue))
    conditions.push(sql<boolean>`(
      project."updatedAt" < ${value}
      or (
        project."updatedAt" = ${value}
        and project."id" < ${input.cursor.id}
      )
    )`)
  }
  return conditions
}

async function selectProjectSummaries(input: {
  archive: ProjectArchiveFilter
  cursor?: PageCursor<'updatedAt'> | null
  id?: string
  limit: number
  organizationId: string
  search?: string
  userId: string
}) {
  const result = await sql<ProjectSummaryRow>`
    select
      project.*,
      (
        select count(*)::integer
        from "assets" asset
        where asset."organizationId" = ${input.organizationId}
          and asset."projectId" = project."id"
          and asset."deletedAt" is null
          and asset."purgeRequestedAt" is null
          and asset."purgedAt" is null
      ) as "assetCount",
      (
        select count(*)::integer
        from "folders" folder
        where folder."organizationId" = ${input.organizationId}
          and folder."projectId" = project."id"
      ) as "folderCount",
      (
        select count(*)::integer
        from "flows" flow
        where flow."organizationId" = ${input.organizationId}
          and flow."projectId" = project."id"
      ) as "flowCount",
      (
        select count(*)::integer
        from "createSessions" session
        where session."organizationId" = ${input.organizationId}
          and session."projectId" = project."id"
          and session."createdBy" = ${input.userId}
          and session."deletedAt" is null
      ) as "createSessionCount",
      (
        select count(*)::integer
        from "elements" element
        where element."organizationId" = ${input.organizationId}
          and element."projectId" = project."id"
      ) as "elementCount"
    from "projects" project
    where ${sql.join(projectConditions(input), sql` and `)}
    order by project."updatedAt" desc, project."id" desc
    limit ${input.limit}
  `.execute(db)
  return result.rows
}

/** Lists Project summaries with one look-ahead row for cursor pagination. */
export function listProjectRows(input: {
  archive: ProjectArchiveFilter
  cursor: PageCursor<'updatedAt'> | null
  limit: number
  organizationId: string
  search?: string
  userId: string
}) {
  return selectProjectSummaries({ ...input, limit: input.limit + 1 })
}

/** Loads one tenant-owned Project summary regardless of archive state. */
export async function findProjectSummaryRow(input: {
  id: string
  organizationId: string
  userId: string
}) {
  return (await selectProjectSummaries({
    archive: 'all',
    id: input.id,
    limit: 1,
    organizationId: input.organizationId,
    userId: input.userId,
  }))[0]
}

/** Loads Project cover Assets in one tenant-scoped batch. */
export function listProjectCoverAssetRows(
  organizationId: string,
  assetIds: readonly string[],
) {
  if (assetIds.length === 0)
    return Promise.resolve([])
  return db.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', 'in', [...new Set(assetIds)])
    .where('deletedAt', 'is', null)
    .where('purgeRequestedAt', 'is', null)
    .where('purgedAt', 'is', null)
    .execute()
}

/** Inserts one Project with no implicit folders or Brief document. */
export function insertProjectRow(input: {
  createdBy: string
  description: string
  id: string
  name: string
  organizationId: string
}) {
  return db.insertInto('projects')
    .values(input)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/** Updates validated Project metadata and returns the resulting row. */
export function updateProjectRow(input: {
  coverAssetId?: null | string
  defaultAssetFolderId?: null | string
  description?: string
  id: string
  name?: string
  organizationId: string
}) {
  return db.transaction().execute(async (trx) => {
    await lockProjectScopes(trx, input.organizationId, [input.id])
    const project = await trx.selectFrom('projects')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .where('archivedAt', 'is', null)
      .forUpdate()
      .executeTakeFirst()
    if (!project)
      return { status: 'not_found' as const }
    if (input.coverAssetId) {
      const asset = await trx.selectFrom('assets')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('projectId', '=', input.id)
        .where('id', '=', input.coverAssetId)
        .where('deletedAt', 'is', null)
        .where('purgeRequestedAt', 'is', null)
        .where('purgedAt', 'is', null)
        .forShare()
        .executeTakeFirst()
      if (!asset)
        return { field: 'coverAssetId' as const, status: 'not_found' as const }
    }
    if (input.defaultAssetFolderId) {
      const folder = await trx.selectFrom('folders')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('projectId', '=', input.id)
        .where('id', '=', input.defaultAssetFolderId)
        .forShare()
        .executeTakeFirst()
      if (!folder) {
        return {
          field: 'defaultAssetFolderId' as const,
          status: 'not_found' as const,
        }
      }
    }
    const updated = await trx.updateTable('projects')
      .set({
        ...(input.coverAssetId !== undefined
          ? { coverAssetId: input.coverAssetId }
          : {}),
        ...(input.defaultAssetFolderId !== undefined
          ? { defaultAssetFolderId: input.defaultAssetFolderId }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow()
    return { project: updated, status: 'updated' as const }
  })
}

/** Sets or clears the soft-archive instant while locking the Project row. */
export function setProjectArchivedRow(input: {
  archived: boolean
  id: string
  organizationId: string
}) {
  return db.transaction().execute(async (trx) => {
    await lockProjectScopes(trx, input.organizationId, [input.id])
    const project = await trx.selectFrom('projects')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (!project)
      return undefined
    return trx.updateTable('projects')
      .set({
        archivedAt: input.archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow()
  })
}
