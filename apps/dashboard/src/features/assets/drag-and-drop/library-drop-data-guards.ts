/** Runtime validation for Asset-library draggables and folder drop targets. */

import type {
  FolderDropTargetData,
  LibraryDragData,
} from './asset-drag-data'

import {
  isAssetDragData,
  isFolderDragData,
} from './library-drag-data-guards'

/** Validates an unknown pragmatic-drop payload as a folder target. */
export function isFolderDropTargetData(
  data: Record<string, unknown>,
): data is FolderDropTargetData {
  return data.type === 'folder-drop-target' && typeof data.folderId === 'string'
}

/** Validates an unknown payload as either supported library draggable. */
export function isLibraryDragData(
  data: Record<string, unknown>,
): data is LibraryDragData {
  return isAssetDragData(data) || isFolderDragData(data)
}
