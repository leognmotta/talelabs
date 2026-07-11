import type { Folder } from '@talelabs/sdk'
import type {
  AssetUploadBatch,
  RunAssetUploadBatch,
} from './asset-upload-batch'
import type { AssetUploadSelection } from './asset-upload-selection'

import { useCallback, useEffect, useRef } from 'react'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { throwIfAssetUploadBatchInactive } from './asset-upload-batch'

function getFolderSegments(relativePath: string) {
  return relativePath.split('/').slice(0, -1)
}

function getFolderKey(parentId: null | string, name: string) {
  return `${parentId ?? 'root'}\u0000${name}`
}

export function useAssetFolderUpload({
  createFolder,
  folders,
  parentFolderId,
  runBatch,
  uploadFiles,
}: {
  createFolder: (
    input: { name: string, parentId: null | string },
    signal: AbortSignal,
  ) => Promise<Folder>
  folders: Folder[]
  parentFolderId: null | string
  runBatch: RunAssetUploadBatch
  uploadFiles: (
    files: File[],
    folderId: null | string,
    batch: AssetUploadBatch,
  ) => Promise<void>
}) {
  const organizationId = useActiveOrganizationId()
  const createFolderRef = useRef(createFolder)
  const foldersRef = useRef(folders)
  const organizationIdRef = useRef(organizationId)
  const parentFolderIdRef = useRef(parentFolderId)
  organizationIdRef.current = organizationId
  parentFolderIdRef.current = parentFolderId

  useEffect(() => {
    createFolderRef.current = createFolder
    foldersRef.current = folders
  })

  const start = useCallback((selections: AssetUploadSelection[]) => runBatch(async (batch) => {
    throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)

    const targetParentFolderId = parentFolderIdRef.current
    const folderByParentAndName = new Map(
      foldersRef.current.map(folder => [getFolderKey(folder.parentId, folder.name), folder]),
    )
    const folderIdByPath = new Map<string, string>()
    const folderPaths = new Set<string>()

    for (const selection of selections) {
      if (!selection.relativePath)
        continue

      const segments = getFolderSegments(selection.relativePath)
      for (let index = 0; index < segments.length; index += 1)
        folderPaths.add(segments.slice(0, index + 1).join('/'))
    }

    const sortedFolderPaths = Array.from(folderPaths)
      .sort((left, right) => left.split('/').length - right.split('/').length)

    for (const path of sortedFolderPaths) {
      throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)

      const segments = path.split('/')
      const name = segments.at(-1)!
      const parentPath = segments.slice(0, -1).join('/')
      const parentId = parentPath
        ? folderIdByPath.get(parentPath) ?? targetParentFolderId
        : targetParentFolderId
      const existingFolder = folderByParentAndName.get(getFolderKey(parentId, name))
      const folder = existingFolder ?? await createFolderRef.current(
        { name, parentId },
        batch.signal,
      )
      throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)

      folderByParentAndName.set(getFolderKey(parentId, name), folder)
      folderIdByPath.set(path, folder.id)
    }

    const filesByFolderId = new Map<null | string, File[]>()
    for (const selection of selections) {
      throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)

      const folderPath = selection.relativePath
        ? getFolderSegments(selection.relativePath).join('/')
        : ''
      const folderId = folderPath
        ? folderIdByPath.get(folderPath) ?? targetParentFolderId
        : targetParentFolderId
      const files = filesByFolderId.get(folderId) ?? []
      files.push(selection.file)
      filesByFolderId.set(folderId, files)
    }

    for (const [folderId, files] of filesByFolderId) {
      throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)
      await uploadFiles(files, folderId, batch)
      throwIfAssetUploadBatchInactive(batch, organizationIdRef.current)
    }
  }), [runBatch, uploadFiles])

  return { start }
}
