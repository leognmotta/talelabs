export interface AssetDragData extends Record<string, unknown> {
  assetIds: string[]
  sourceFolderId: null | string
  type: 'asset'
}

export interface FolderDragData extends Record<string, unknown> {
  folderId: string
  parentId: null | string
  type: 'folder'
}

export interface FolderDropTargetData extends Record<string, unknown> {
  folderId: string
  type: 'folder-drop-target'
}

export type LibraryDragData = AssetDragData | FolderDragData

function isNullableString(value: unknown): value is null | string {
  return value === null || typeof value === 'string'
}

export function isAssetDragData(data: Record<string, unknown>): data is AssetDragData {
  return data.type === 'asset'
    && Array.isArray(data.assetIds)
    && data.assetIds.length > 0
    && data.assetIds.every(id => typeof id === 'string')
    && isNullableString(data.sourceFolderId)
}

export function isFolderDragData(data: Record<string, unknown>): data is FolderDragData {
  return data.type === 'folder'
    && typeof data.folderId === 'string'
    && isNullableString(data.parentId)
}

export function isFolderDropTargetData(data: Record<string, unknown>): data is FolderDropTargetData {
  return data.type === 'folder-drop-target' && typeof data.folderId === 'string'
}

export function isLibraryDragData(data: Record<string, unknown>): data is LibraryDragData {
  return isAssetDragData(data) || isFolderDragData(data)
}
