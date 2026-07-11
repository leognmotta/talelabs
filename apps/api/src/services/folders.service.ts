import { createId } from '@paralleldrive/cuid2'

import {
  createFolderRow,
  deleteFolderRow,
  findFolderRow,
  listFolderRows,
  listFolderThumbnailRows,
  updateFolderRow,
} from '../data/folders.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import { createAssetThumbnailUrl } from './asset-presenter.js'

function presentFolder(folder: {
  createdAt: Date
  id: string
  itemCount: number
  name: string
  parentId: null | string
  processingItemCount: number
  totalSizeBytes: number | string
  updatedAt: Date
}, thumbnailUrls: string[]) {
  return {
    id: folder.id,
    parentId: folder.parentId,
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

export async function listFolders(organizationId: string) {
  const rows = await listFolderRows(organizationId)
  return { data: await presentFolders(rows, organizationId) }
}

export async function createFolder(input: {
  name: string
  organizationId: string
  parentId?: null | string
}) {
  const result = await createFolderRow({
    id: createId(),
    name: input.name,
    organizationId: input.organizationId,
    parentId: input.parentId ?? null,
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
    processingItemCount: 0,
    totalSizeBytes: 0,
  }, [])
}

export async function updateFolder(input: {
  id: string
  name?: string
  organizationId: string
  parentId?: null | string
}) {
  const result = await updateFolderRow(input)

  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError()
  if (result.status === 'parent_not_found')
    throw new TenantResourceNotFoundError('parentId')
  if (result.status === 'cycle' || result.status === 'depth') {
    throw new HttpError(400, 'validation_error', 'The folder could not be moved.', [{
      code: result.status === 'cycle' ? 'folder_cycle' : 'folder_depth',
      field: 'parentId',
      message: result.status === 'cycle'
        ? 'A folder cannot be moved inside itself or one of its descendants.'
        : 'Folders can be nested up to 32 levels.',
    }])
  }

  const folder = await findFolderRow(input.organizationId, result.folder.id)
  return (await presentFolders(folder ? [folder] : [], input.organizationId))[0]!
}

export async function deleteFolder(organizationId: string, id: string) {
  if (!(await deleteFolderRow(organizationId, id)))
    throw new TenantResourceNotFoundError()
}
