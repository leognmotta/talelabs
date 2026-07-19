/** Asset-node toolbar commands backed by narrow canvas and runtime queries. */

import { IconArrowsMaximize, IconCrop, IconDownload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAssetDownload } from '../../../../assets/viewer/use-asset-download'
import { useCanvasStore, useCanvasStoreApi } from '../../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../../editor/flow-canvas-runtime-context'
import { FlowAddToElementToolbarAction } from './flow-add-to-element-toolbar-action'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Renders media tools for one Asset node without observing the graph array. */
export function FlowAssetToolbarActions({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const downloadAsset = useAssetDownload()
  const assetId = useCanvasStore(
    state => state.nodes.find(node => node.id === nodeId)?.assetId,
  )
  const editingImageCropNodeId = useCanvasStore(
    state => state.editingImageCropNodeId,
  )
  const asset = assetId
    ? runtime.referenceData.assetsById.get(assetId)
    : undefined
  const canUseMediaTools = Boolean(
    asset && ['audio', 'image', 'video'].includes(asset.type),
  )
  const canCropImage = Boolean(
    asset?.type === 'image' && (asset.thumbnailUrl || asset.url),
  )

  if (!asset || !canUseMediaTools)
    return null

  async function viewFullscreen() {
    const frame = document.getElementById(`flow-node-media-${nodeId}`)
    if (!frame)
      return
    try {
      await frame.requestFullscreen()
    }
    catch {
      toast.error(t('flows.nodeToolbar.fullscreenFailed'))
    }
  }

  return (
    <>
      {canCropImage && (
        <FlowToolbarButton
          icon={IconCrop}
          label={t('flows.nodeToolbar.crop')}
          pressed={editingImageCropNodeId === nodeId}
          onClick={() => store.setState({
            editingImageCropNodeId: editingImageCropNodeId === nodeId
              ? null
              : nodeId,
          })}
        />
      )}
      <FlowToolbarButton
        icon={IconDownload}
        label={t('assets.download')}
        onClick={() => void downloadAsset(asset.id)}
      />
      {asset.type === 'image' && (
        <FlowAddToElementToolbarAction assetId={asset.id} />
      )}
      <FlowToolbarButton
        icon={IconArrowsMaximize}
        label={t('flows.nodeToolbar.fullscreen')}
        onClick={() => void viewFullscreen()}
      />
    </>
  )
}
