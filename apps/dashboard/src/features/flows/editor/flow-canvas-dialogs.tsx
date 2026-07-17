/** Asset selection dialog for the Flow canvas. */

import type { Asset } from '@talelabs/sdk'

import { memo } from 'react'
import { AssetLibraryDialog } from '../../assets/library/asset-library-dialog'

/** Renders the reusable Asset picker owned by the canvas overlay layer. */
export const FlowCanvasDialogs = memo(({
  assetPickerNodeId,
  onAssetPickerOpenChange,
  onSelectAsset,
  selectedAssetId,
}: {
  assetPickerNodeId: null | string
  onAssetPickerOpenChange: (open: boolean) => void
  onSelectAsset: (asset: Asset) => void
  selectedAssetId: null | string
}) => {
  return (
    <AssetLibraryDialog
      mode="select"
      open={assetPickerNodeId !== null}
      selectedAssetIds={selectedAssetId ? [selectedAssetId] : []}
      onOpenChange={onAssetPickerOpenChange}
      onSelect={onSelectAsset}
    />
  )
})
