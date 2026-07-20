/** Media commands overlaid on one Asset node's preview surface. */

import { IconArrowsMaximize, IconCrop, IconDownload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAssetDownload } from '../../../assets/viewer/use-asset-download'
import { useCanvasStore, useCanvasStoreApi } from '../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../editor/flow-canvas-runtime-context'
import { FlowPreviewActions } from '../shared/media/flow-preview-actions'
import { FlowAddToElementToolbarAction } from '../shared/toolbars/flow-add-to-element-toolbar-action'
import { FlowToolbarButton } from '../shared/toolbars/flow-toolbar-button'

/** Renders media tools for one Asset node without observing the graph array. */
export function AssetPreviewActions({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const downloadAsset = useAssetDownload()
  const assetId = useCanvasStore(
    state => state.nodes.find(node => node.id === nodeId)?.assetId,
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
    <FlowPreviewActions label={t('flows.nodeActions')}>
      {canCropImage && (
        <FlowToolbarButton
          icon={IconCrop}
          label={t('flows.nodeToolbar.crop')}
          onClick={() => store.setState({ editingImageCropNodeId: nodeId })}
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
    </FlowPreviewActions>
  )
}
