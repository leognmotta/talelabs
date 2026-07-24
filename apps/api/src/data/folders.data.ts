/** Kysely data access for folders: tree reads, moves, depth/limit guards. */

import type { FolderTable } from '@talelabs/db'
import type { Selectable } from 'kysely'

import {
  db,
  lockFolderStructure,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS_PER_ORGANIZATION,
  sql,
} from '@talelabs/db'
import {
  lockActiveProject,
  lockActiveProjects,
  lockProjectScopes,
  touchProject,
} from '../domain/projects/project-scope.js'

export {
  lockFolderStructure,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS_PER_ORGANIZATION,
}

/** A folder row with derived item counts and total size. */
export type FolderContentRow = Selectable<FolderTable> & {
  assetCount: number
  childFolderCount: number
  itemCount: number
  processingItemCount: number
  totalSizeBytes: string
}

async function getFolderRows(
  organizationId: string,
  id?: string,
  projectId?: null | string,
) {
  const projectCondition = projectId === null
    ? sql`and folder."projectId" is null`
    : projectId !== undefined
      ? sql`and folder."projectId" = ${projectId}`
      : sql``
  const result = await sql<FolderContentRow>`
    with recursive folder_tree as (
      select
        root."id" as "rootId",
        root."id" as "descendantId"
      from "folders" root
      where root."organizationId" = ${organizationId}
        ${id ? sql`and root."id" = ${id}` : sql``}
      union all
      select
        tree."rootId",
        child."id" as "descendantId"
      from folder_tree tree
      join "folders" child
        on child."organizationId" = ${organizationId}
        and child."parentId" = tree."descendantId"
    ), folder_sizes as (
      select
        tree."rootId",
        coalesce(sum(asset."sizeBytes"), 0)::bigint as "totalSizeBytes"
      from folder_tree tree
      left join "assets" asset
        on asset."organizationId" = ${organizationId}
        and asset."folderId" = tree."descendantId"
        and asset."deletedAt" is null
        and asset."purgeRequestedAt" is null
        and asset."purgedAt" is null
      group by tree."rootId"
    )
    select
      folder.*,
      (
        select count(*)
        from "assets" asset
        where asset."organizationId" = ${organizationId}
          and asset."folderId" = folder."id"
          and asset."deletedAt" is null
          and asset."purgeRequestedAt" is null
          and asset."purgedAt" is null
      )::integer as "assetCount",
      (
        select count(*)
        from "folders" child
        where child."organizationId" = ${organizationId}
          and child."parentId" = folder."id"
      )::integer as "childFolderCount",
      (
        (
          select count(*) from "assets" asset
          where asset."organizationId" = ${organizationId}
            and asset."folderId" = folder."id"
            and asset."deletedAt" is null
            and asset."purgeRequestedAt" is null
            and asset."purgedAt" is null
        ) + (
          select count(*) from "folders" child
          where child."organizationId" = ${organizationId}
            and child."parentId" = folder."id"
        )
      )::integer as "itemCount",
      (
        select count(*)
        from "assets" asset
        where asset."organizationId" = ${organizationId}
          and asset."folderId" = folder."id"
          and asset."processingState" = 'processing'
          and asset."deletedAt" is null
          and asset."purgeRequestedAt" is null
          and asset."purgedAt" is null
      )::integer as "processingItemCount",
      coalesce(folder_size."totalSizeBytes", 0)::bigint as "totalSizeBytes"
    from "folders" folder
    left join folder_sizes folder_size on folder_size."rootId" = folder."id"
    where folder."organizationId" = ${organizationId}
      ${id ? sql`and folder."id" = ${id}` : sql``}
      ${projectCondition}
    order by folder."name", folder."id"
  `.execute(db)

  return result.rows
}

/** Lists all folders for one organization with content aggregates. */
export function listFolderRows(
  organizationId: string,
  projectId?: null | string,
) {
  return getFolderRows(organizationId, undefined, projectId)
}

/** Loads one folder with its content aggregates, or undefined. */
export async function findFolderRow(organizationId: string, id: string) {
  return (await getFolderRows(organizationId, id))[0]
}

/** Creates a folder transactionally, enforcing count and depth limits. */
export async function createFolderRow(input: {
  id: string
  name: string
  organizationId: string
  parentId: null | string
  projectId?: null | string
}) {
  return db.transaction().execute(async (trx) => {
    let projectId = input.projectId ?? null
    if (input.parentId) {
      const parent = await trx.selectFrom('folders')
        .select('projectId')
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.parentId)
        .executeTakeFirst()
      if (!parent)
        return { status: 'parent_not_found' as const }
      if (
        input.projectId !== undefined
        && input.projectId !== parent.projectId
      ) {
        return { status: 'parent_not_found' as const }
      }
      projectId = parent.projectId
    }
    await lockProjectScopes(trx, input.organizationId, [projectId])
    await lockActiveProject(trx, input.organizationId, projectId)
    await lockFolderStructure(trx, input.organizationId)
    if (input.parentId) {
      const parent = await trx.selectFrom('folders')
        .select('projectId')
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.parentId)
        .forShare()
        .executeTakeFirst()
      if (!parent || parent.projectId !== projectId)
        return { status: 'parent_not_found' as const }
    }

    const count = await trx.selectFrom('folders')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .executeTakeFirstOrThrow()

    if (Number(count.count) >= MAX_FOLDERS_PER_ORGANIZATION)
      return { status: 'limit' as const }

    if (input.parentId) {
      const depth = await getFolderDepth(trx, input.organizationId, input.parentId)

      if (depth === null)
        return { status: 'parent_not_found' as const }

      if (depth >= MAX_FOLDER_DEPTH)
        return { status: 'depth' as const }
    }

    const folder = await trx.insertInto('folders')
      .values({ ...input, projectId })
      .returningAll()
      .executeTakeFirstOrThrow()

    await touchProject(trx, input.organizationId, projectId)
    return { folder, status: 'created' as const }
  })
}

/** Renames/moves a folder transactionally, rejecting cycles and depth overflow. */
export async function updateFolderRow(input: {
  id: string
  name?: string
  organizationId: string
  parentId?: null | string
  projectId?: null | string
}) {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('folders')
      .select(['parentId', 'projectId'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .executeTakeFirst()
    if (!initial)
      return { status: 'not_found' as const }

    let targetProjectId = input.projectId !== undefined
      ? input.projectId
      : initial.projectId
    let targetParentId = input.parentId !== undefined
      ? input.parentId
      : initial.parentId
    if (
      input.projectId !== undefined
      && input.projectId !== initial.projectId
      && input.parentId === undefined
    ) {
      targetParentId = null
    }
    if (targetParentId) {
      const parent = await trx.selectFrom('folders')
        .select('projectId')
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', targetParentId)
        .executeTakeFirst()
      if (!parent)
        return { status: 'parent_not_found' as const }
      if (
        input.projectId !== undefined
        && parent.projectId !== input.projectId
      ) {
        return { status: 'parent_not_found' as const }
      }
      targetProjectId = parent.projectId
    }
    await lockProjectScopes(
      trx,
      input.organizationId,
      [initial.projectId, targetProjectId],
    )
    await lockActiveProjects(
      trx,
      input.organizationId,
      [initial.projectId, targetProjectId],
    )
    await lockFolderStructure(trx, input.organizationId)

    const folder = await trx.selectFrom('folders')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()

    if (!folder)
      return { status: 'not_found' as const }
    if (
      folder.parentId !== initial.parentId
      || folder.projectId !== initial.projectId
    ) {
      return { status: 'invalid_state' as const }
    }

    if (targetParentId !== null) {
      if (targetParentId === input.id)
        return { status: 'cycle' as const }

      const ancestors = await sql<{
        depth: number
        id: string
        projectId: null | string
      }>`
        with recursive ancestors as (
          select f."id", f."parentId", f."projectId", 1 as depth
          from "folders" f
          where f."organizationId" = ${input.organizationId}
            and f."id" = ${targetParentId}
          union all
          select
            parent."id",
            parent."parentId",
            parent."projectId",
            ancestors.depth + 1
          from "folders" parent
          join ancestors on ancestors."parentId" = parent."id"
          where parent."organizationId" = ${input.organizationId}
            and ancestors.depth < ${MAX_FOLDER_DEPTH + 1}
        )
        select "id", "projectId", depth from ancestors
      `.execute(trx)

      if (ancestors.rows.length === 0)
        return { status: 'parent_not_found' as const }
      if (ancestors.rows.some(row => row.projectId !== targetProjectId))
        return { status: 'parent_not_found' as const }

      if (ancestors.rows.some(row => row.id === input.id))
        return { status: 'cycle' as const }

      const parentDepth = Math.max(...ancestors.rows.map(row => row.depth))
      const subtreeDepth = await getSubtreeDepth(trx, input.organizationId, input.id)

      if (parentDepth + subtreeDepth > MAX_FOLDER_DEPTH)
        return { status: 'depth' as const }
    }

    if (targetProjectId !== folder.projectId) {
      const subtree = await sql<{ id: string, systemRole: null | string }>`
        with recursive descendants as (
          select current."id", current."systemRole"
          from "folders" current
          where current."organizationId" = ${input.organizationId}
            and current."id" = ${input.id}
          union all
          select child."id", child."systemRole"
          from "folders" child
          join descendants on child."parentId" = descendants."id"
          where child."organizationId" = ${input.organizationId}
        )
        select "id", "systemRole"
        from descendants
        order by "id"
      `.execute(trx)
      const folderIds = subtree.rows.map(row => row.id)
      const activeRun = await trx.selectFrom('flowRuns')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('assetFolderId', 'in', folderIds)
        .where('status', 'in', ['pending', 'running'])
        .executeTakeFirst()
      if (activeRun)
        return { status: 'active_destination' as const }

      const flowOwners = await trx.selectFrom('flows')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('assetFolderId', 'in', folderIds)
        .orderBy('id')
        .forUpdate()
        .execute()
      const sessionOwners = await trx.selectFrom('createSessions')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('assetFolderId', 'in', folderIds)
        .orderBy('id')
        .forUpdate()
        .execute()
      if (
        flowOwners.length
        || sessionOwners.length
        || subtree.rows.some(row => row.systemRole !== null)
      ) {
        return { status: 'managed_folder' as const }
      }

      await trx.updateTable('projects')
        .set({ defaultAssetFolderId: null, updatedAt: new Date() })
        .where('organizationId', '=', input.organizationId)
        .where('defaultAssetFolderId', 'in', folderIds)
        .execute()
      await trx.updateTable('projects')
        .set({ coverAssetId: null, updatedAt: new Date() })
        .where('organizationId', '=', input.organizationId)
        .where(eb => eb('coverAssetId', 'in', eb.selectFrom('assets')
          .select('id')
          .where('organizationId', '=', input.organizationId)
          .where('folderId', 'in', folderIds)))
        .execute()
      await trx.updateTable('folders')
        .set({ projectId: targetProjectId, updatedAt: new Date() })
        .where('organizationId', '=', input.organizationId)
        .where('id', 'in', folderIds)
        .execute()
      await trx.updateTable('assets')
        .set({ projectId: targetProjectId, updatedAt: new Date() })
        .where('organizationId', '=', input.organizationId)
        .where('folderId', 'in', folderIds)
        .execute()
    }

    const updated = await trx.updateTable('folders')
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        parentId: targetParentId,
        projectId: targetProjectId,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    await touchProject(trx, input.organizationId, folder.projectId)
    if (targetProjectId !== folder.projectId)
      await touchProject(trx, input.organizationId, targetProjectId)
    return { folder: updated, status: 'updated' as const }
  })
}

/** Deletes a folder subtree, locking affected Flows and Assets in order. */
export async function deleteFolderRow(organizationId: string, id: string) {
  return db.transaction().execute(async (trx) => {
    const initial = await trx.selectFrom('folders')
      .select('projectId')
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .executeTakeFirst()
    if (!initial)
      return { status: 'not_found' as const }
    await lockProjectScopes(trx, organizationId, [initial.projectId])
    await lockActiveProjects(trx, organizationId, [initial.projectId])
    await lockFolderStructure(trx, organizationId)

    const subtree = await sql<{ id: string }>`
      with recursive descendants as (
        select folder."id"
        from "folders" folder
        where folder."organizationId" = ${organizationId}
          and folder."id" = ${id}
        union all
        select child."id"
        from "folders" child
        join descendants
          on child."parentId" = descendants."id"
        where child."organizationId" = ${organizationId}
      )
      select "id"
      from descendants
      order by "id"
    `.execute(trx)
    const folderIds = subtree.rows.map(folder => folder.id)
    if (folderIds.length === 0)
      return { status: 'not_found' as const }

    const activeRun = await trx.selectFrom('flowRuns')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('assetFolderId', 'in', folderIds)
      .where('status', 'in', ['pending', 'running'])
      .executeTakeFirst()
    if (activeRun)
      return { status: 'active_destination' as const }

    // The FK actions clear Flow associations and Asset locations. Lock
    // affected rows explicitly in the shared folder -> Flow -> Asset
    // order used by output materialization and link mutations.
    await trx.selectFrom('flows')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('assetFolderId', 'in', folderIds)
      .orderBy('id')
      .forUpdate()
      .execute()
    await trx.selectFrom('createSessions')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('assetFolderId', 'in', folderIds)
      .orderBy('id')
      .forUpdate()
      .execute()
    await trx.selectFrom('assets')
      .select('id')
      .where('organizationId', '=', organizationId)
      .where('folderId', 'in', folderIds)
      .orderBy('id')
      .forUpdate()
      .execute()

    const deleted = await trx.deleteFrom('folders')
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .returning('id')
      .executeTakeFirst()
    await touchProject(trx, organizationId, initial.projectId)
    return deleted
      ? { id: deleted.id, status: 'deleted' as const }
      : { status: 'not_found' as const }
  })
}

/** Returns the 1-based ancestor depth of a folder, or null if absent. */
export async function getFolderDepth(
  executor: Parameters<typeof getSubtreeDepth>[0],
  organizationId: string,
  id: string,
) {
  const result = await sql<{ depth: number }>`
    with recursive ancestors as (
      select f."id", f."parentId", 1 as depth
      from "folders" f
      where f."organizationId" = ${organizationId} and f."id" = ${id}
      union all
      select parent."id", parent."parentId", ancestors.depth + 1
      from "folders" parent
      join ancestors on ancestors."parentId" = parent."id"
      where parent."organizationId" = ${organizationId}
        and ancestors.depth < ${MAX_FOLDER_DEPTH + 1}
    )
    select max(depth)::integer as depth from ancestors
  `.execute(executor)

  return result.rows[0]?.depth ?? null
}

async function getSubtreeDepth(
  executor: typeof db,
  organizationId: string,
  id: string,
) {
  const result = await sql<{ depth: number }>`
    with recursive descendants as (
      select f."id", 1 as depth
      from "folders" f
      where f."organizationId" = ${organizationId} and f."id" = ${id}
      union all
      select child."id", descendants.depth + 1
      from "folders" child
      join descendants on child."parentId" = descendants."id"
      where child."organizationId" = ${organizationId}
        and descendants.depth < ${MAX_FOLDER_DEPTH + 1}
    )
    select max(depth)::integer as depth from descendants
  `.execute(executor)

  return result.rows[0]?.depth ?? 1
}
