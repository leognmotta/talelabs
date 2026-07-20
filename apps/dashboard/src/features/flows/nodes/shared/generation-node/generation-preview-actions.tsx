/** Output media commands overlaid on one generation node's preview. */

import { IconCrop } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useAssetDownload } from '../../../../assets/viewer/use-asset-download'
import { useCanvasStore, useCanvasStoreApi } from '../../../editor/canvas-state/canvas-store-context'
import { useFlowGenerationPreview } from '../../../editor/flow-canvas-runtime-context'
import { FLOW_NODE_METADATA } from '../../flow-node-metadata'
import { FlowPreviewActions } from '../media/flow-preview-actions'
import { downloadFile } from '../toolbars/download-file'
import { FlowAddToElementToolbarAction } from '../toolbars/flow-add-to-element-toolbar-action'
import { FlowCopyOutputToolbarAction } from '../toolbars/flow-copy-output-toolbar-action'
import { FlowDownloadToolbarAction } from '../toolbars/flow-download-toolbar-action'
import { FlowToolbarButton } from '../toolbars/flow-toolbar-button'

/**
 * Renders the metadata-configured output commands for one generation node as a
 * hover cluster on its preview. Renders nothing until an output exists and
 * hides itself while the node is in crop-editing mode.
 */
export function GenerationPreviewActions({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const nodeType = useCanvasStore(
    state => state.nodes.find(node => node.id === nodeId)?.type,
  )
  const editingImageCrop = useCanvasStore(
    state => state.editingImageCropNodeId === nodeId,
  )
  const downloadAsset = useAssetDownload()
  const preview = useFlowGenerationPreview(nodeId)
  const actions = nodeType
    ? FLOW_NODE_METADATA[nodeType].toolbarActions
    : undefined
  const output = preview && 'output' in preview ? preview.output ?? null : null
  const outputAssetId = output?.kind === 'media' ? output.assetId : undefined
  const outputText = output?.kind === 'text' ? output.text : null
  const canCropOutput = Boolean(
    output?.kind === 'media'
    && output.mediaType === 'image'
    && output.download.content,
  )
  const downloadOutput = output?.kind === 'media'
    ? outputAssetId
      ? () => void downloadAsset(outputAssetId)
      : undefined
    : output
      ? () => downloadFile(output.download)
      : undefined

  if (!actions || !output || editingImageCrop)
    return null

  return (
    <FlowPreviewActions label={t('flows.nodeActions')}>
      {actions.map((action) => {
        if (action === 'addToElement') {
          if (output.kind !== 'media'
            || output.mediaType !== 'image'
            || !outputAssetId) {
            return null
          }
          return (
            <FlowAddToElementToolbarAction
              assetId={outputAssetId}
              key={action}
            />
          )
        }
        if (action === 'copyOutput') {
          return (
            <FlowCopyOutputToolbarAction
              key={action}
              outputText={outputText}
            />
          )
        }
        if (action === 'download') {
          return (
            <FlowDownloadToolbarAction
              key={action}
              onDownload={downloadOutput}
            />
          )
        }
        if (!canCropOutput)
          return null
        return (
          <FlowToolbarButton
            key={action}
            icon={IconCrop}
            label={t('flows.nodeToolbar.crop')}
            onClick={() => store.setState({ editingImageCropNodeId: nodeId })}
          />
        )
      })}
    </FlowPreviewActions>
  )
}
