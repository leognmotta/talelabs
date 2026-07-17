/** Runtime validation for Asset and folder drag payloads. */

import type { AssetDragData, FolderDragData } from './asset-drag-data'

function isNullableString(value: unknown): value is null | string {
  return value === null || typeof value === 'string'
}

/** Validates an unknown pragmatic-drag payload as an Asset selection. */
export function isAssetDragData(
  data: Record<string, unknown>,
): data is AssetDragData {
  return data.type === 'asset'
    && Array.isArray(data.assetIds)
    && data.assetIds.length > 0
    && data.assetIds.every(id => typeof id === 'string')
    && isNullableString(data.sourceFolderId)
}

/** Validates an unknown pragmatic-drag payload as one folder. */
export function isFolderDragData(
  data: Record<string, unknown>,
): data is FolderDragData {
  return data.type === 'folder'
    && typeof data.folderId === 'string'
    && isNullableString(data.parentId)
}
