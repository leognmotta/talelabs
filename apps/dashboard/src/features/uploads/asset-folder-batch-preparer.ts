import type { UploadCacheAdapter } from './upload-cache'
import type { RuntimeUploadBatch } from './upload-runtime'
import type { UploadItemState } from './upload.types'

import { uploadStore } from './upload-store'

function getFolderSegments(relativePath: string) {
  return relativePath.split('/').slice(0, -1)
}

function getFolderKey(parentId: null | string, name: string) {
  return `${parentId ?? 'root'}\u0000${name}`
}

function batchItems(batchId: string) {
  const state = uploadStore.getState()
  return state.batches[batchId]?.itemIds
    .map(id => state.items[id])
    .filter((item): item is UploadItemState => Boolean(item)) ?? []
}

export function assetFolderBatchTargetsFolders(
  batch: RuntimeUploadBatch,
  folderIds: ReadonlySet<string>,
) {
  if (batch.parentFolderId && folderIds.has(batch.parentFolderId))
    return true

  const foldersByParentAndName = new Map(
    batch.folders.map(folder => [
      getFolderKey(folder.parentId, folder.name),
      folder,
    ]),
  )

  return batchItems(batch.id).some((item) => {
    if (
      item.destinationFolderId
      && folderIds.has(item.destinationFolderId)
    ) {
      return true
    }
    if (batch.prepared || !item.relativePath)
      return false

    let parentId = batch.parentFolderId
    for (const segment of getFolderSegments(item.relativePath)) {
      const folder = foldersByParentAndName.get(
        getFolderKey(parentId, segment),
      )
      if (!folder)
        return false
      if (folderIds.has(folder.id))
        return true
      parentId = folder.id
    }
    return false
  })
}

export async function prepareAssetFolderBatch(
  batch: RuntimeUploadBatch,
  cache: UploadCacheAdapter,
  assertActive: () => void,
) {
  assertActive()
  const items = batchItems(batch.id)
  const folderByParentAndName = new Map(
    batch.folders.map(folder => [
      getFolderKey(folder.parentId, folder.name),
      folder,
    ]),
  )
  const folderIdByPath = new Map<string, string>()
  const folderPaths = new Set<string>()

  for (const item of items) {
    if (!item.relativePath)
      continue
    const segments = getFolderSegments(item.relativePath)
    for (let index = 0; index < segments.length; index += 1)
      folderPaths.add(segments.slice(0, index + 1).join('/'))
  }

  const sortedFolderPaths = Array.from(folderPaths)
    .sort((left, right) => left.split('/').length - right.split('/').length)
  for (const path of sortedFolderPaths) {
    assertActive()
    const pathStillNeeded = batchItems(batch.id).some((item) => {
      if (item.status !== 'queued' || !item.relativePath)
        return false
      const itemPath = getFolderSegments(item.relativePath).join('/')
      return itemPath === path || itemPath.startsWith(`${path}/`)
    })
    if (!pathStillNeeded)
      continue

    const segments = path.split('/')
    const name = segments.at(-1)
    if (!name)
      continue
    const parentPath = segments.slice(0, -1).join('/')
    const parentId = parentPath
      ? folderIdByPath.get(parentPath) ?? batch.parentFolderId
      : batch.parentFolderId
    const existing = folderByParentAndName.get(getFolderKey(parentId, name))
    const folder = existing ?? await cache.createFolder(
      batch.organizationId,
      { name, parentId },
      batch.controller.signal,
    )
    assertActive()
    if (!existing)
      batch.folders.push(folder)
    folderByParentAndName.set(getFolderKey(parentId, name), folder)
    folderIdByPath.set(path, folder.id)
  }

  for (const item of items) {
    const folderPath = item.relativePath
      ? getFolderSegments(item.relativePath).join('/')
      : ''
    uploadStore.getState().patchItem(item.id, {
      destinationFolderId: folderPath
        ? folderIdByPath.get(folderPath) ?? batch.parentFolderId
        : batch.parentFolderId,
    })
  }
  batch.prepared = true
  batch.folders = []
}
