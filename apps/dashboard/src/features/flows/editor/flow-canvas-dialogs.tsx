/** Asset and Element selection dialogs for the Flow canvas. */

import type { Asset } from '@talelabs/sdk'
import type { ElementNodePick } from '../../elements/element-node-picker-dialog'

import { memo } from 'react'
import { AssetLibraryDialog } from '../../assets/library/asset-library-dialog'
import { ElementNodePickerDialog } from '../../elements/element-node-picker-dialog'

/** Renders the reusable Asset and Element pickers owned by the canvas overlay layer. */
export const FlowCanvasDialogs = memo(({
  assetPickerNodeId,
  elementPickerNodeId,
  elementSelectedAssetIds,
  onAssetPickerOpenChange,
  onConfirmElement,
  onElementPickerOpenChange,
  onSelectAsset,
  selectedAssetId,
  selectedElementId,
}: {
  assetPickerNodeId: null | string
  elementPickerNodeId: null | string
  elementSelectedAssetIds: null | string[]
  onAssetPickerOpenChange: (open: boolean) => void
  onConfirmElement: (pick: ElementNodePick) => void
  onElementPickerOpenChange: (open: boolean) => void
  onSelectAsset: (asset: Asset) => void
  selectedAssetId: null | string
  selectedElementId: null | string
}) => {
  return (
    <>
      <AssetLibraryDialog
        mode="select"
        open={assetPickerNodeId !== null}
        selectedAssetIds={selectedAssetId ? [selectedAssetId] : []}
        onOpenChange={onAssetPickerOpenChange}
        onSelect={onSelectAsset}
      />
      <ElementNodePickerDialog
        currentElementId={selectedElementId}
        currentSelectedAssetIds={elementSelectedAssetIds}
        open={elementPickerNodeId !== null}
        onConfirm={onConfirmElement}
        onOpenChange={onElementPickerOpenChange}
      />
    </>
  )
})
