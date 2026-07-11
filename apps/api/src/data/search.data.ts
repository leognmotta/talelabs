import type { AssetType, Database } from '@talelabs/db'
import type { Transaction } from 'kysely'

import { db, sql } from '@talelabs/db'

const SEARCH_STATEMENT_TIMEOUT_MS = 1_500

export interface AssetSearchRow {
  id: string
  name: string
  thumbnailKey: null | string
  type: AssetType
}

export interface FolderSearchRow {
  id: string
  name: string
  path: string
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

async function searchAssetRows(
  executor: Transaction<Database>,
  input: { limit: number, organizationId: string, query: string },
) {
  const normalizedQuery = input.query.toLocaleLowerCase()
  const containsPattern = `%${escapeLike(normalizedQuery)}%`
  const prefixPattern = `${escapeLike(normalizedQuery)}%`

  const result = await sql<AssetSearchRow>`
    select
      asset."id",
      asset."name",
      asset."thumbnailKey",
      asset."type"
    from "assets" asset
    where asset."organizationId" = ${input.organizationId}
      and asset."deletedAt" is null
      and asset."purgeRequestedAt" is null
      and lower(asset."name") like ${containsPattern} escape '\\'
    order by
      case
        when lower(asset."name") = ${normalizedQuery} then 0
        when lower(asset."name") like ${prefixPattern} escape '\\' then 1
        else 2
      end,
      similarity(lower(asset."name"), ${normalizedQuery}) desc,
      lower(asset."name"),
      asset."id"
    limit ${input.limit}
  `.execute(executor)

  return result.rows
}

async function searchFolderRows(
  executor: Transaction<Database>,
  input: { limit: number, organizationId: string, query: string },
) {
  const normalizedQuery = input.query.toLocaleLowerCase()
  const containsPattern = `%${escapeLike(normalizedQuery)}%`
  const prefixPattern = `${escapeLike(normalizedQuery)}%`

  const result = await sql<FolderSearchRow>`
    with recursive matches as (
      select
        folder."id",
        folder."parentId",
        folder."name",
        case
          when lower(folder."name") = ${normalizedQuery} then 0
          when lower(folder."name") like ${prefixPattern} escape '\\' then 1
          else 2
        end as relevance,
        similarity(lower(folder."name"), ${normalizedQuery}) as score
      from "folders" folder
      where folder."organizationId" = ${input.organizationId}
        and lower(folder."name") like ${containsPattern} escape '\\'
      order by relevance, score desc, lower(folder."name"), folder."id"
      limit ${input.limit}
    ), path_parts as (
      select
        match."id" as "folderId",
        match."id" as "nodeId",
        match."parentId",
        array[match."name"]::text[] as "pathNames"
      from matches match
      union all
      select
        path."folderId",
        parent."id" as "nodeId",
        parent."parentId",
        array[parent."name"] || path."pathNames"
      from path_parts path
      join "folders" parent
        on parent."organizationId" = ${input.organizationId}
        and parent."id" = path."parentId"
    )
    select
      match."id",
      match."name",
      array_to_string(path."pathNames", ' / ') as "path"
    from matches match
    join path_parts path
      on path."folderId" = match."id"
      and path."parentId" is null
    order by match.relevance, match.score desc, lower(match."name"), match."id"
  `.execute(executor)

  return result.rows
}

export function searchWorkspaceRows(input: {
  includeAssets: boolean
  includeFolders: boolean
  limit: number
  organizationId: string
  query: string
}) {
  return db.transaction().execute(async (transaction) => {
    await sql`set local statement_timeout = ${sql.raw(String(SEARCH_STATEMENT_TIMEOUT_MS))}`
      .execute(transaction)

    const assets = input.includeAssets
      ? await searchAssetRows(transaction, input)
      : []
    const folders = input.includeFolders
      ? await searchFolderRows(transaction, input)
      : []

    return { assets, folders }
  })
}
