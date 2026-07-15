import type { Kysely } from 'kysely'

import { createHash } from 'node:crypto'

import { sql } from 'kysely'

const FLOW_ROOT_NAME = 'Flow'
const FLOW_ROOT_SYSTEM_ROLE = 'flows_root'
const MAX_FOLDERS_PER_ORGANIZATION = 500

interface FlowWithRootOutputs {
  assetFolderId: null | string
  id: string
  name: string
  organizationId: string
}

function migrationFolderId(scope: string) {
  return `f${createHash('sha256').update(scope).digest('hex').slice(0, 23)}`
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

async function folderCount(db: Kysely<unknown>, organizationId: string) {
  const result = await sql<{ count: string }>`
    select count(*)::text as count
    from "folders"
    where "organizationId" = ${organizationId}
  `.execute(db)
  return Number(result.rows[0]?.count ?? 0)
}

async function ensureFlowRoot(db: Kysely<unknown>, organizationId: string) {
  const identified = await sql<{ id: string }>`
    select "id"
    from "folders"
    where "organizationId" = ${organizationId}
      and "systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
    limit 1
  `.execute(db)
  if (identified.rows[0])
    return identified.rows[0].id

  const named = await sql<{ id: string }>`
    select "id"
    from "folders"
    where "organizationId" = ${organizationId}
      and "parentId" is null
      and lower("name") in (lower(${FLOW_ROOT_NAME}), lower(${'Flows'}))
    order by
      case when lower("name") = lower(${FLOW_ROOT_NAME}) then 0 else 1 end,
      "id"
    limit 1
  `.execute(db)
  if (named.rows[0]) {
    await sql`
      update "folders"
      set "name" = ${FLOW_ROOT_NAME},
          "systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
      where "organizationId" = ${organizationId}
        and "id" = ${named.rows[0].id}
    `.execute(db)
    return named.rows[0].id
  }

  if (await folderCount(db, organizationId) >= MAX_FOLDERS_PER_ORGANIZATION)
    return null

  const id = migrationFolderId(`talelabs:flow-output-root:${organizationId}`)
  await sql`
    insert into "folders" (
      "id", "organizationId", "parentId", "name", "systemRole"
    ) values (
      ${id}, ${organizationId}, null, ${FLOW_ROOT_NAME}, ${FLOW_ROOT_SYSTEM_ROLE}
    )
  `.execute(db)
  return id
}

export async function up(db: Kysely<unknown>) {
  await sql`
    update "folders"
    set "name" = ${FLOW_ROOT_NAME}
    where "systemRole" = ${FLOW_ROOT_SYSTEM_ROLE}
      and "name" <> ${FLOW_ROOT_NAME}
  `.execute(db)

  const flows = await sql<FlowWithRootOutputs>`
    select distinct
      flow."assetFolderId",
      flow."id",
      flow."name",
      flow."organizationId"
    from "flows" flow
    join "generationJobs" job
      on job."organizationId" = flow."organizationId"
      and job."flowId" = flow."id"
    join "assets" asset
      on asset."organizationId" = job."organizationId"
      and asset."generationJobId" = job."id"
    where asset."source" = 'generation'
      and asset."folderId" is null
    order by flow."organizationId", flow."id"
  `.execute(db)

  for (const flow of flows.rows) {
    let folderId = flow.assetFolderId
    if (!folderId) {
      const rootId = await ensureFlowRoot(db, flow.organizationId)
      if (!rootId)
        continue
      if (await folderCount(db, flow.organizationId) >= MAX_FOLDERS_PER_ORGANIZATION)
        continue

      const siblings = await sql<{ name: string }>`
        select "name"
        from "folders"
        where "organizationId" = ${flow.organizationId}
          and "parentId" = ${rootId}
      `.execute(db)
      folderId = migrationFolderId(`talelabs:flow-output:${flow.organizationId}:${flow.id}`)
      const folderName = availableFolderName(
        flow.name,
        siblings.rows.map(sibling => sibling.name),
      )
      await sql`
        insert into "folders" (
          "id", "organizationId", "parentId", "name"
        ) values (
          ${folderId}, ${flow.organizationId}, ${rootId}, ${folderName}
        )
      `.execute(db)
      await sql`
        update "flows"
        set "assetFolderId" = ${folderId}
        where "organizationId" = ${flow.organizationId}
          and "id" = ${flow.id}
          and "assetFolderId" is null
      `.execute(db)
    }

    await sql`
      update "assets" asset
      set "folderId" = ${folderId}
      from "generationJobs" job
      where asset."organizationId" = ${flow.organizationId}
        and asset."source" = 'generation'
        and asset."folderId" is null
        and job."organizationId" = asset."organizationId"
        and job."id" = asset."generationJobId"
        and job."flowId" = ${flow.id}
    `.execute(db)
  }
}

/** This data organization migration is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
