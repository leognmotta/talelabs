import type { ReactNode } from 'react'
import type { FlowGenerationToolbarAction } from './flow-dashboard-node-registry'

import { downloadFile } from './download-file'
import { useFlowCanvas } from './flow-canvas-context'
import { FlowCopyOutputToolbarAction } from './flow-copy-output-toolbar-action'
import { FlowDownloadToolbarAction } from './flow-download-toolbar-action'

export function FlowGenerationOutputToolbarActions({
  actions,
  nodeId,
}: {
  actions: readonly FlowGenerationToolbarAction[]
  nodeId: string
}) {
  const canvas = useFlowCanvas()
  const preview = canvas.getGenerationPreview(nodeId)
  const output = preview?.status === 'succeeded' ? preview.output : null
  const outputText = output?.kind === 'text' ? output.text : null
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
  } satisfies Record<FlowGenerationToolbarAction, () => ReactNode>

  return actions.map(action => renderAction[action]())
}
