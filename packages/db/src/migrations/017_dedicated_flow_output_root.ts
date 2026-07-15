import type { Kysely } from 'kysely'

import { createHash } from 'node:crypto'

import { sql } from 'kysely'

const FLOW_ROOT_NAME = 'Flow'
const FLOW_ROOT_SYSTEM_ROLE = 'flows_root'
const CLAIMING_MIGRATION = '015_flow_output_asset_folders'

interface ClaimedRoot {
  id: string
  organizationId: string
}

function migrationFolderId(organizationId: string) {
  return `f${createHash('sha256')
    .update(`talelabs:dedicated-flow-output-root:${organizationId}`)
    .digest('hex')
    .slice(0, 23)}`
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

/**
 * Migration 015 could adopt a pre-existing customer folder named Flow/Flows.
 * Its migration timestamp lets us distinguish those older folders from roots
 * created by the migration or later runtime provisioning.
 */
export async function up(db: Kysely<unknown>) {
  const claimedRoots = await sql<ClaimedRoot>`
    select folder."id", folder."organizationId"
    from "folders" folder
    join "kysely_migration" migration
      on migration."name" = ${CLAIMING_MIGRATION}
    where folder."systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
      and folder."createdAt" < migration."timestamp"::timestamptz
    order by folder."organizationId", folder."id"
  `.execute(db)

  for (const claimedRoot of claimedRoots.rows) {
    const rootNames = await sql<{ name: string }>`
      select "name"
      from "folders"
      where "organizationId" = ${claimedRoot.organizationId}
        and "parentId" is null
    `.execute(db)
    const dedicatedRootId = migrationFolderId(claimedRoot.organizationId)
    const dedicatedRootName = availableFolderName(
      FLOW_ROOT_NAME,
      rootNames.rows.map(folder => folder.name),
    )

    await sql`
      update "folders"
      set "systemRole" = null
      where "organizationId" = ${claimedRoot.organizationId}
        and "id" = ${claimedRoot.id}
        and "systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
    `.execute(db)

    await sql`
      insert into "folders" (
        "id", "organizationId", "parentId", "name", "systemRole"
      ) values (
        ${dedicatedRootId},
        ${claimedRoot.organizationId},
        null,
        ${dedicatedRootName},
        ${FLOW_ROOT_SYSTEM_ROLE}
      )
    `.execute(db)

    await sql`
      update "folders" output_folder
      set "parentId" = ${dedicatedRootId}
      where output_folder."organizationId" = ${claimedRoot.organizationId}
        and output_folder."parentId" = ${claimedRoot.id}
        and exists (
          select 1
          from "flows" flow
          where flow."organizationId" = output_folder."organizationId"
            and flow."assetFolderId" = output_folder."id"
        )
    `.execute(db)
  }
}

/** This ownership repair is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
