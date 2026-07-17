/** Selection-aware Asset projections used by drag and bulk library actions. */

import type { Asset } from '@talelabs/sdk'
import type { AssetDragData } from '../drag-and-drop/asset-drag-data'

/** Builds the Asset drag payload, expanding to the active multi-selection. */
export function getAssetDragSelection(
  assets: Asset[],
  selectedAssetIds: ReadonlySet<string>,
  asset: Asset,
): AssetDragData {
  const assetIds = selectedAssetIds.has(asset.id)
    ? assets
        .filter(item => selectedAssetIds.has(item.id))
        .map(item => item.id)
    : [asset.id]

  return {
    assetIds: assetIds.length > 0 ? assetIds : [asset.id],
    sourceFolderId: asset.folderId,
    type: 'asset',
  }
}

/** Returns the active Asset selection when the action target belongs to it. */
export function getSelectedAssets(
  assets: Asset[],
  selectedAssetIds: ReadonlySet<string>,
  asset: Asset,
) {
  return selectedAssetIds.has(asset.id)
    ? assets.filter(item => selectedAssetIds.has(item.id))
    : [asset]
}
