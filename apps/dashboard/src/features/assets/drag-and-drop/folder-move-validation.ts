/** Admission rules for moving Assets and folder subtrees within the library. */

import type { Folder } from '@talelabs/sdk'
import type { LibraryDragData } from './asset-drag-data'

import {
  getFolderDepth,
  getFolderSubtreeDepth,
  isFolderDescendant,
} from './folder-tree-metrics'

const MAX_FOLDER_DEPTH = 32

/** Stable reason why a library move cannot be admitted. */
export type MoveRejection = 'depth' | 'descendant' | 'same-folder' | 'self'

/** Admission result shared by drop targets and the move dialog. */
export type MoveValidation
  = | { allowed: true }
    | { allowed: false, reason: MoveRejection }

/** Validates moving one folder without creating cycles or exceeding depth 32. */
export function validateFolderMove(
  source: { folderId: string, parentId: null | string },
  destinationFolderId: null | string,
  folders: Folder[],
): MoveValidation {
  if (destinationFolderId === source.folderId)
    return { allowed: false, reason: 'self' }

  if (destinationFolderId === source.parentId)
    return { allowed: false, reason: 'same-folder' }

  if (destinationFolderId === null)
    return { allowed: true }

  const foldersById = new Map(folders.map(folder => [folder.id, folder]))

  if (isFolderDescendant(source.folderId, destinationFolderId, foldersById))
    return { allowed: false, reason: 'descendant' }

  const destinationDepth = getFolderDepth(destinationFolderId, foldersById)
  const subtreeDepth = getFolderSubtreeDepth(source.folderId, folders)

  if (destinationDepth + subtreeDepth > MAX_FOLDER_DEPTH)
    return { allowed: false, reason: 'depth' }

  return { allowed: true }
}

/** Validates an Asset or folder move against its current and destination folder. */
export function validateLibraryMove(
  source: LibraryDragData,
  destinationFolderId: null | string,
  folders: Folder[],
): MoveValidation {
  if (source.type === 'asset') {
    return source.sourceFolderId === destinationFolderId
      ? { allowed: false, reason: 'same-folder' }
      : { allowed: true }
  }

  return validateFolderMove(source, destinationFolderId, folders)
}
