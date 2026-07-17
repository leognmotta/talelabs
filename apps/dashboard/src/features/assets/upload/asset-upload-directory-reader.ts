/** Recursive File System Entry traversal for directory drag-and-drop uploads. */

import type { AssetUploadSelection } from './asset-upload-selection-contract'

import { normalizeAssetUploadRelativePath } from './asset-upload-relative-path'

/** Resolves a legacy browser file entry to its File value. */
export function getFileFromEntry(entry: FileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => entry.file(resolve, reject))
}

/** Drains every batch returned by a directory reader until it reports completion. */
export async function readAssetUploadDirectoryEntries(
  entry: FileSystemDirectoryEntry,
) {
  const reader = entry.createReader()
  const entries: FileSystemEntry[] = []

  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })

    if (batch.length === 0)
      return entries

    entries.push(...batch)
  }
}

/** Recursively converts one file-system entry into normalized upload selections. */
export async function readAssetUploadEntry(
  entry: FileSystemEntry,
  parentPath: string,
): Promise<AssetUploadSelection[]> {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name

  if (entry.isFile) {
    const file = await getFileFromEntry(entry as FileSystemFileEntry)
    return [{
      file,
      relativePath: normalizeAssetUploadRelativePath(path),
    }]
  }

  if (!entry.isDirectory)
    return []

  const children = await readAssetUploadDirectoryEntries(
    entry as FileSystemDirectoryEntry,
  )
  const nestedSelections = await Promise.all(
    children.map(child => readAssetUploadEntry(child, path)),
  )
  return nestedSelections.flat()
}
