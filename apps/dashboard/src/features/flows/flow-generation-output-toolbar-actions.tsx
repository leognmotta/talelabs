/** Output-specific generation toolbar commands for copy, download, and crop. */

import type { FlowGenerationToolbarAction } from './flow-dashboard-node-registry'

import { IconCrop } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useAssetDownload } from '../assets/use-asset-download'
import { useCanvasStore, useCanvasStoreApi } from './canvas-state/canvas-store-context'
import { downloadFile } from './download-file'
import { useFlowGenerationPreview } from './flow-canvas-runtime-context'
import { FlowCopyOutputToolbarAction } from './flow-copy-output-toolbar-action'
import { FlowDownloadToolbarAction } from './flow-download-toolbar-action'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Renders the configured output commands for one generation node. */
export function FlowGenerationOutputToolbarActions({
  actions,
  nodeId,
}: {
  actions: readonly FlowGenerationToolbarAction[]
  nodeId: string
}) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const editingImageCropNodeId = useCanvasStore(
    state => state.editingImageCropNodeId,
  )
  const downloadAsset = useAssetDownload()
  const preview = useFlowGenerationPreview(nodeId)
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
  return actions.map((action) => {
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
        pressed={editingImageCropNodeId === nodeId}
        onClick={() => store.setState({
          editingImageCropNodeId: editingImageCropNodeId === nodeId
            ? null
            : nodeId,
        })}
      />
    )
  })
}
