import type { ReactNode } from 'react'
import type { FlowGenerationToolbarAction } from './flow-dashboard-node-registry'

import { IconCrop } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { downloadFile } from './download-file'
import { useFlowCanvas } from './flow-canvas-context'
import { FlowCopyOutputToolbarAction } from './flow-copy-output-toolbar-action'
import { FlowDownloadToolbarAction } from './flow-download-toolbar-action'
import { FlowToolbarButton } from './flow-toolbar-button'

export function FlowGenerationOutputToolbarActions({
  actions,
  nodeId,
}: {
  actions: readonly FlowGenerationToolbarAction[]
  nodeId: string
}) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const preview = canvas.getGenerationPreview(nodeId)
  const output = preview?.status === 'succeeded' ? preview.output : null
  const outputText = output?.kind === 'text' ? output.text : null
  const canCropOutput = Boolean(
    output?.kind === 'media'
    && output.mediaType === 'image'
    && output.download.content,
  )
  const downloadOutput = output
    ? () => downloadFile(output.download)
    : undefined
  const renderAction = {
    copyOutput: () => (
      <FlowCopyOutputToolbarAction
        key="copyOutput"
        outputText={outputText}
      />
    ),
    download: () => (
      <FlowDownloadToolbarAction
        key="download"
        onDownload={downloadOutput}
      />
    ),
    crop: () => canCropOutput
      ? (
          <FlowToolbarButton
            key="crop"
            icon={IconCrop}
            label={t('flows.nodeToolbar.crop')}
            pressed={canvas.editingImageCropNodeId === nodeId}
            onClick={() => canvas.setEditingImageCropNodeId(
              canvas.editingImageCropNodeId === nodeId ? null : nodeId,
            )}
          />
        )
      : null,
  } satisfies Record<FlowGenerationToolbarAction, () => ReactNode>

  return actions.map(action => renderAction[action]())
}
