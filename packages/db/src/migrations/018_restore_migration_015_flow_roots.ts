import type { Kysely } from 'kysely'

import { createHash } from 'node:crypto'

import { sql } from 'kysely'

const FLOW_ROOT_SYSTEM_ROLE = 'flows_root'

interface ManagedRoot {
  id: string
  organizationId: string
}

function migrationFolderId(scope: string) {
  return `f${createHash('sha256').update(scope).digest('hex').slice(0, 23)}`
}

function migration015RootId(organizationId: string) {
  return migrationFolderId(`talelabs:flow-output-root:${organizationId}`)
}

function migration017RootId(organizationId: string) {
  return migrationFolderId(`talelabs:dedicated-flow-output-root:${organizationId}`)
}

/**
 * Migration 017's timestamp check also matched roots created transactionally by
 * migration 015. Repair only that deterministic identity pair; adopted customer
 * folders have unrelated IDs and must remain ordinary folders.
 */
export async function up(db: Kysely<unknown>) {
  const managedRoots = await sql<ManagedRoot>`
    select "id", "organizationId"
    from "folders"
    where "systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
      and "parentId" is null
    order by "organizationId", "id"
  `.execute(db)

  for (const managedRoot of managedRoots.rows) {
    if (managedRoot.id !== migration017RootId(managedRoot.organizationId))
      continue

    const originalRootId = migration015RootId(managedRoot.organizationId)
    await sql`
      select pg_advisory_xact_lock(
        hashtextextended(${`talelabs:folders:${managedRoot.organizationId}`}, 0)
      )
    `.execute(db)

    const originalRoot = await sql<{ id: string }>`
      select "id"
      from "folders"
      where "organizationId" = ${managedRoot.organizationId}
        and "id" = ${originalRootId}
        and "parentId" is null
        and "systemRole" is null
      limit 1
    `.execute(db)
    if (!originalRoot.rows[0])
      continue

    const releasedReplacement = await sql<{ id: string }>`
      update "folders"
      set "systemRole" = null
      where "organizationId" = ${managedRoot.organizationId}
        and "id" = ${managedRoot.id}
        and "parentId" is null
        and "systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
      returning "id"
    `.execute(db)
    if (!releasedReplacement.rows[0])
      continue

    const restoredOriginal = await sql<{ id: string }>`
      update "folders"
      set "systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
      where "organizationId" = ${managedRoot.organizationId}
        and "id" = ${originalRootId}
        and "parentId" is null
        and "systemRole" is null
      returning "id"
    `.execute(db)
    if (!restoredOriginal.rows[0])
      throw new Error('migration_018_flow_root_restore_failed')

    await sql`
      update "folders" output_folder
      set "parentId" = ${originalRootId}
      where output_folder."organizationId" = ${managedRoot.organizationId}
        and output_folder."parentId" = ${managedRoot.id}
        and exists (
          select 1
          from "flows" flow
          where flow."organizationId" = output_folder."organizationId"
            and flow."assetFolderId" = output_folder."id"
        )
    `.execute(db)

    await sql`
      delete from "folders" replacement
      where replacement."organizationId" = ${managedRoot.organizationId}
        and replacement."id" = ${managedRoot.id}
        and replacement."parentId" is null
        and replacement."systemRole" is null
        and not exists (
          select 1 from "folders" child
          where child."organizationId" = replacement."organizationId"
            and child."parentId" = replacement."id"
        )
        and not exists (
          select 1 from "assets" asset
          where asset."organizationId" = replacement."organizationId"
            and asset."folderId" = replacement."id"
        )
        and not exists (
          select 1 from "flows" flow
          where flow."organizationId" = replacement."organizationId"
            and flow."assetFolderId" = replacement."id"
        )
        and not exists (
          select 1 from "elements" element
          where element."organizationId" = replacement."organizationId"
            and element."assetFolderId" = replacement."id"
        )
    `.execute(db)
  }
}

/** This ownership repair is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
