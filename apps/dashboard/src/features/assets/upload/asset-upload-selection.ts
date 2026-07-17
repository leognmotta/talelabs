/** Browser file selections normalized for flat and directory upload batches. */

import type { AssetUploadSelection } from './asset-upload-selection-contract'

import { getFileFromEntry, readAssetUploadEntry } from './asset-upload-directory-reader'
import { normalizeAssetUploadRelativePath } from './asset-upload-relative-path'

/** Converts input or picker files into normalized upload selections. */
export function getAssetUploadSelections(files: File[] | FileList): AssetUploadSelection[] {
  return Array.from(files, file => ({
    file,
    relativePath: normalizeAssetUploadRelativePath(file.webkitRelativePath),
  }))
}

/** Recursively expands dropped directories while preserving their relative paths. */
export async function getDroppedAssetUploadSelections(dataTransfer: DataTransfer) {
  const fileItems = Array.from(dataTransfer.items).filter(item => item.kind === 'file')
  const entries = fileItems
    .map(item => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => Boolean(entry))

  if (entries.some(entry => entry.isDirectory)) {
    const selections = await Promise.all(entries.map((entry) => {
      if (entry.isFile) {
        return getFileFromEntry(entry as FileSystemFileEntry)
          .then(file => [{ file, relativePath: null }])
      }

      return readAssetUploadEntry(entry, '')
    }))

    return selections.flat()
  }

  return getAssetUploadSelections(dataTransfer.files)
}
