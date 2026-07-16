import type { Database, Transaction } from '@talelabs/db'

import {
  MAX_FOLDER_DEPTH,
  sql,
} from '@talelabs/db'

export type OutputFolderExecutor = Transaction<Database>

export async function countFolders(
  executor: OutputFolderExecutor,
  organizationId: string,
) {
  const row = await executor.selectFrom('folders')
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

export async function getFolderDepth(
  executor: OutputFolderExecutor,
  organizationId: string,
  folderId: string,
) {
  const result = await sql<{ depth: number }>`
    with recursive ancestors as (
      select folder."id", folder."parentId", 1 as depth
      from "folders" folder
      where folder."organizationId" = ${organizationId}
        and folder."id" = ${folderId}
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
