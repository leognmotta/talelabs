/** Folder tree presentation and validated structural mutation workflows. */

import { createId } from '@paralleldrive/cuid2'

import {
  listFolderThumbnailRows,
  listProjectFolderTreeRows,
} from '../data/folder-read-projections.data.js'
import {
  createFolderRow,
  deleteFolderRow,
  findFolderRow,
  listFolderRows,
  updateFolderRow,
} from '../data/folders.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import { createAssetThumbnailUrl } from './asset-presenter.js'

function presentFolder(folder: {
  assetCount: number
  childFolderCount: number
  createdAt: Date
  id: string
  itemCount: number
  name: string
  parentId: null | string
  projectId: null | string
  processingItemCount: number
  totalSizeBytes: number | string
  updatedAt: Date
}, thumbnailUrls: string[]) {
  return {
    id: folder.id,
    assetCount: folder.assetCount,
    childFolderCount: folder.childFolderCount,
    parentId: folder.parentId,
    projectId: folder.projectId,
    name: folder.name,
    itemCount: folder.itemCount,
    processingItemCount: folder.processingItemCount,
    totalSizeBytes: Number(folder.totalSizeBytes),
    thumbnailUrls,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  }
}

async function presentFolders(
  folders: Awaited<ReturnType<typeof listFolderRows>>,
  organizationId: string,
) {
  if (folders.length === 0)
    return []

  const folderIds = new Set(folders.map(folder => folder.id))
  const thumbnails = await listFolderThumbnailRows(organizationId, [...folderIds])
  const thumbnailUrls = await Promise.all(thumbnails.map(async thumbnail => ({
    folderId: thumbnail.folderId,
    url: await createAssetThumbnailUrl(thumbnail),
  })))
  const urlsByFolderId = new Map<string, string[]>()

  for (const thumbnail of thumbnailUrls) {
    if (!thumbnail.url)
      continue
    const urls = urlsByFolderId.get(thumbnail.folderId) ?? []
    urls.push(thumbnail.url)
    urlsByFolderId.set(thumbnail.folderId, urls)
  }

  return folders.map(folder => presentFolder(folder, urlsByFolderId.get(folder.id) ?? []))
}

/** Lists one bounded flat folder set with cover thumbnails. */
export async function listFolders(
  organizationId: string,
  projectId?: null | string,
) {
  const rows = await listFolderRows(organizationId, projectId)
  return { data: await presentFolders(rows, organizationId) }
}

/** Lists the compact Project-scoped hierarchy used by contextual navigation. */
export async function listProjectFolderTree(
  organizationId: string,
  projectId: string,
) {
  return {
    data: await listProjectFolderTreeRows(organizationId, projectId),
  }
}

/** Creates one folder after tenant, Project, limit, and depth validation. */
export async function createFolder(input: {
  name: string
  organizationId: string
  parentId?: null | string
  projectId?: null | string
}) {
  const result = await createFolderRow({
    id: createId(),
    name: input.name,
    organizationId: input.organizationId,
    parentId: input.parentId ?? null,
    projectId: input.projectId,
  })

  if (result.status === 'parent_not_found')
    throw new TenantResourceNotFoundError('parentId')
  if (result.status === 'limit' || result.status === 'depth') {
    throw new HttpError(400, 'validation_error', 'The folder could not be created.', [{
      code: result.status === 'limit' ? 'folder_limit' : 'folder_depth',
      field: result.status === 'limit' ? 'name' : 'parentId',
      message: result.status === 'limit'
        ? 'This workspace has reached its folder limit.'
        : 'Folders can be nested up to 32 levels.',
    }])
  }

  return presentFolder({
    ...result.folder,
    itemCount: 0,
    assetCount: 0,
    childFolderCount: 0,
    processingItemCount: 0,
    totalSizeBytes: 0,
  }, [])
}

/** Renames or atomically moves one folder subtree. */
export async function updateFolder(input: {
  id: string
  name?: string
  organizationId: string
  parentId?: null | string
  projectId?: null | string
}) {
  const result = await updateFolderRow(input)

  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError()
  if (result.status === 'parent_not_found')
    throw new TenantResourceNotFoundError('parentId')
  if (result.status === 'invalid_state') {
    throw new HttpError(
      409,
      'invalid_state',
      'The folder location changed while it was being moved.',
    )
  }
  if (result.status === 'cycle' || result.status === 'depth') {
    throw new HttpError(400, 'validation_error', 'The folder could not be moved.', [{
      code: result.status === 'cycle' ? 'folder_cycle' : 'folder_depth',
      field: 'parentId',
      message: result.status === 'cycle'
        ? 'A folder cannot be moved inside itself or one of its descendants.'
        : 'Folders can be nested up to 32 levels.',
    }])
  }
  if (result.status === 'active_destination') {
    throw new HttpError(
      409,
      'invalid_state',
      'This folder is the captured destination of an active generation.',
      [{
        code: 'active_run_destination',
        field: 'projectId',
        message: 'Wait for active generation to finish before moving the folder.',
      }],
    )
  }
  if (result.status === 'managed_folder') {
    throw new HttpError(
      409,
      'invalid_state',
      'Move the Flow or Create session that owns this output folder.',
      [{
        code: 'managed_output_folder',
        field: 'projectId',
        message: 'Use the source location control to move its managed folder.',
      }],
    )
  }

  const folder = await findFolderRow(input.organizationId, result.folder.id)
  return (await presentFolders(folder ? [folder] : [], input.organizationId))[0]!
}

/** Deletes one folder subtree while preserving canonical Assets at root. */
export async function deleteFolder(organizationId: string, id: string) {
  const result = await deleteFolderRow(organizationId, id)
  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError()
  if (result.status === 'active_destination') {
    throw new HttpError(
      409,
      'invalid_state',
      'This folder is the captured destination of an active generation.',
      [{
        code: 'active_run_destination',
        field: 'id',
        message: 'Wait for active generation to finish before deleting the folder.',
      }],
    )
  }
}
