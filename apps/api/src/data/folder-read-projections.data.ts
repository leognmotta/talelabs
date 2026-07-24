/** Read-only compact tree and thumbnail projections for Asset folders. */

import type { AssetType, AssetVisibility } from '@talelabs/db'

import { db, sql } from '@talelabs/db'

/** Maximum cover candidates loaded for one folder. */
export const MAX_FOLDER_THUMBNAILS = 4

/** One preview Asset used to build a folder cover collage. */
export interface FolderThumbnailRow {
  /** Owning folder identity. */
  folderId: string
  /** Stored media MIME type. */
  mimeType: string
  /** Canonical source-object key. */
  storageKey: string
  /** Optional derived thumbnail-object key. */
  thumbnailKey: null | string
  /** Canonical Asset media family. */
  type: AssetType
  /** Access policy applied while signing the preview. */
  visibility: AssetVisibility
}

interface ProjectFolderTreeRow {
  assetCount: number
  id: string
  name: string
  parentId: null | string
}

/** Lists Project folder hierarchy with direct Asset counts only. */
export async function listProjectFolderTreeRows(
  organizationId: string,
  projectId: string,
) {
  const result = await sql<ProjectFolderTreeRow>`
    select
      folder."id",
      folder."name",
      folder."parentId",
      count(asset."id")::integer as "assetCount"
    from "folders" folder
    left join "assets" asset
      on asset."organizationId" = ${organizationId}
      and asset."folderId" = folder."id"
      and asset."deletedAt" is null
      and asset."purgeRequestedAt" is null
      and asset."purgedAt" is null
    where folder."organizationId" = ${organizationId}
      and folder."projectId" = ${projectId}
    group by
      folder."id",
      folder."name",
      folder."parentId"
    order by folder."name", folder."id"
  `.execute(db)

  return result.rows
}

/** Loads the newest preview Assets per folder for cover collages. */
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
        asset."visibility",
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
      "type",
      "visibility"
    from ranked_assets
    where preview_rank <= ${MAX_FOLDER_THUMBNAILS}
    order by "folderId", preview_rank
  `.execute(db)

  return result.rows
}
