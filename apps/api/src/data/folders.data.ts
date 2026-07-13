import type { AssetType, FolderTable } from '@talelabs/db'
import type { Selectable } from 'kysely'

import { createId } from '@paralleldrive/cuid2'
import { db, sql } from '@talelabs/db'

export const MAX_FOLDER_DEPTH = 32
export const MAX_FOLDERS_PER_ORGANIZATION = 500
export const MAX_FOLDER_THUMBNAILS = 4
export const ELEMENTS_ROOT_SYSTEM_ROLE = 'elements_root'

export type FolderContentRow = Selectable<FolderTable> & {
  itemCount: number
  processingItemCount: number
  totalSizeBytes: string
}

export interface FolderThumbnailRow {
  folderId: string
  mimeType: string
  storageKey: string
  thumbnailKey: null | string
  type: AssetType
}

export async function lockFolderStructure(
  executor: typeof db,
  organizationId: string,
) {
  await sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`talelabs:folders:${organizationId}`}, 0)
    )
  `.execute(executor)
}

function availableFolderName(baseName: string, occupiedNames: string[]) {
  const occupied = new Set(occupiedNames.map(name => name.toLowerCase()))
  if (!occupied.has(baseName.toLowerCase()))
    return baseName

  for (let suffix = 2; ; suffix += 1) {
    const suffixText = ` ${suffix}`
    const candidate = `${baseName.slice(0, 255 - suffixText.length)}${suffixText}`
    if (!occupied.has(candidate.toLowerCase()))
      return candidate
  }
}

async function countFolders(executor: typeof db, organizationId: string) {
  const row = await executor.selectFrom('folders')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

export type ProvisionElementAssetFolderResult
  = | { folderId: string, status: 'provisioned' }
    | { status: 'depth' }
    | { status: 'limit' }

/**
 * Provisions the stable folder used by one Element. The advisory lock serializes
 * this with ordinary folder creates, moves, and deletes, so collision suffixes
 * and the single workspace Elements root remain deterministic.
 */
export async function provisionElementAssetFolderRow(
  executor: typeof db,
  input: { elementName: string, organizationId: string },
): Promise<ProvisionElementAssetFolderResult> {
  await lockFolderStructure(executor, input.organizationId)

  let root = await executor.selectFrom('folders')
    .select(['id', 'parentId'])
    .where('organizationId', '=', input.organizationId)
    .where('systemRole', '=', ELEMENTS_ROOT_SYSTEM_ROLE)
    .executeTakeFirst()

  if (!root) {
    const existingRoot = await executor.selectFrom('folders')
      .select(['id', 'parentId'])
      .where('organizationId', '=', input.organizationId)
      .where('parentId', 'is', null)
      .where(sql<boolean>`lower("name") = lower(${'Elements'})`)
      .orderBy('id')
      .executeTakeFirst()

    if (existingRoot) {
      root = await executor.updateTable('folders')
        .set({ systemRole: ELEMENTS_ROOT_SYSTEM_ROLE, updatedAt: new Date() })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', existingRoot.id)
        .returning(['id', 'parentId'])
        .executeTakeFirstOrThrow()
    }
    else {
      if (await countFolders(executor, input.organizationId) >= MAX_FOLDERS_PER_ORGANIZATION)
        return { status: 'limit' }

      const rootNames = await executor.selectFrom('folders')
        .select('name')
        .where('organizationId', '=', input.organizationId)
        .where('parentId', 'is', null)
        .execute()
      root = await executor.insertInto('folders')
        .values({
          id: createId(),
          name: availableFolderName('Elements', rootNames.map(folder => folder.name)),
          organizationId: input.organizationId,
          parentId: null,
          systemRole: ELEMENTS_ROOT_SYSTEM_ROLE,
        })
        .returning(['id', 'parentId'])
        .executeTakeFirstOrThrow()
    }
  }

  if (await countFolders(executor, input.organizationId) >= MAX_FOLDERS_PER_ORGANIZATION)
    return { status: 'limit' }

  const rootDepth = await getFolderDepth(executor, input.organizationId, root.id)
  if (rootDepth === null || rootDepth >= MAX_FOLDER_DEPTH)
    return { status: 'depth' }

  const siblings = await executor.selectFrom('folders')
    .select('name')
    .where('organizationId', '=', input.organizationId)
    .where('parentId', '=', root.id)
    .execute()
  const folder = await executor.insertInto('folders')
    .values({
      id: createId(),
      name: availableFolderName(
        input.elementName,
        siblings.map(sibling => sibling.name),
      ),
      organizationId: input.organizationId,
      parentId: root.id,
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  return { folderId: folder.id, status: 'provisioned' }
}

async function getFolderRows(organizationId: string, id?: string) {
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
        (
          select count(*)
          from "assets" asset
          where asset."organizationId" = ${organizationId}
            and asset."folderId" = folder."id"
            and asset."deletedAt" is null
            and asset."purgeRequestedAt" is null
            and asset."purgedAt" is null
        ) + (
          select count(*)
          from "folders" child
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
    order by folder."name", folder."id"
  `.execute(db)

  return result.rows
}

export function listFolderRows(organizationId: string) {
  return getFolderRows(organizationId)
}

export async function findFolderRow(organizationId: string, id: string) {
  return (await getFolderRows(organizationId, id))[0]
}

export async function listFolderThumbnailRows(
  organizationId: string,
  folderIds?: string[],
) {
  if (folderIds?.length === 0)
    return []

  const result = await sql<FolderThumbnailRow>`
    with ranked_assets as (
      select
        asset."folderId",
        asset."mimeType",
        asset."storageKey",
        asset."thumbnailKey",
        asset."type",
        row_number() over (
          partition by asset."folderId"
          order by asset."createdAt" desc, asset."id" desc
        ) as preview_rank
      from "assets" asset
      where asset."organizationId" = ${organizationId}
        and asset."folderId" is not null
        ${folderIds
          ? sql`and asset."folderId" in (${sql.join(folderIds.map(id => sql`${id}`))})`
          : sql``}
        and asset."deletedAt" is null
        and asset."purgeRequestedAt" is null
        and asset."purgedAt" is null
        and (asset."type" = 'image' or asset."thumbnailKey" is not null)
    )
    select
      "folderId",
      "mimeType",
      "storageKey",
      "thumbnailKey",
      "type"
    from ranked_assets
    where preview_rank <= ${MAX_FOLDER_THUMBNAILS}
    order by "folderId", preview_rank
  `.execute(db)

  return result.rows
}

export async function createFolderRow(input: {
  id: string
  name: string
  organizationId: string
  parentId: null | string
}) {
  return db.transaction().execute(async (trx) => {
    await lockFolderStructure(trx, input.organizationId)

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
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow()

    return { folder, status: 'created' as const }
  })
}

export async function updateFolderRow(input: {
  id: string
  name?: string
  organizationId: string
  parentId?: null | string
}) {
  return db.transaction().execute(async (trx) => {
    await lockFolderStructure(trx, input.organizationId)

    const folder = await trx.selectFrom('folders')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()

    if (!folder)
      return { status: 'not_found' as const }

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === input.id)
        return { status: 'cycle' as const }

      const ancestors = await sql<{ depth: number, id: string }>`
        with recursive ancestors as (
          select f."id", f."parentId", 1 as depth
          from "folders" f
          where f."organizationId" = ${input.organizationId}
            and f."id" = ${input.parentId}
          union all
          select parent."id", parent."parentId", ancestors.depth + 1
          from "folders" parent
          join ancestors on ancestors."parentId" = parent."id"
          where parent."organizationId" = ${input.organizationId}
            and ancestors.depth < ${MAX_FOLDER_DEPTH + 1}
        )
        select "id", depth from ancestors
      `.execute(trx)

      if (ancestors.rows.length === 0)
        return { status: 'parent_not_found' as const }

      if (ancestors.rows.some(row => row.id === input.id))
        return { status: 'cycle' as const }

      const parentDepth = Math.max(...ancestors.rows.map(row => row.depth))
      const subtreeDepth = await getSubtreeDepth(trx, input.organizationId, input.id)

      if (parentDepth + subtreeDepth > MAX_FOLDER_DEPTH)
        return { status: 'depth' as const }
    }

    const updated = await trx.updateTable('folders')
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return { folder: updated, status: 'updated' as const }
  })
}

export async function deleteFolderRow(organizationId: string, id: string) {
  return db.transaction().execute(async (trx) => {
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
      return undefined

    // The FK actions clear both Element and Asset folder references. Lock the
    // affected rows explicitly in the shared folder -> Element -> Asset order
    // so a link mutation cannot hold an Element while waiting on an Asset that
    // the folder delete locked before its FK action reaches that Element.
    await trx.selectFrom('elements')
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

    return trx.deleteFrom('folders')
      .where('organizationId', '=', organizationId)
      .where('id', '=', id)
      .returning('id')
      .executeTakeFirst()
  })
}

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
