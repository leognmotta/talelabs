/** Selection-aware toolbar composition for one custom Flow node. */
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { IconLock, IconLockOpen } from '@tabler/icons-react'
import { NodeToolbar, Position } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { updateCanvasNodeData } from './canvas-state/canvas-node-actions'
import { useCanvasStore, useCanvasStoreApi } from './canvas-state/canvas-store-context'
import { FlowAssetToolbarActions } from './flow-asset-toolbar-actions'
import { useFlowCanvasRuntime } from './flow-canvas-runtime-context'
import { getFlowDashboardNodeDefinition } from './flow-dashboard-node-registry'
import { FlowGenerationOutputToolbarActions } from './flow-generation-output-toolbar-actions'
import { FlowGenerationToolbarActions } from './flow-generation-toolbar-actions'
import { FlowNodeToolbarActions } from './flow-node-toolbar-actions'
import { FlowToolbarButton } from './flow-toolbar-button'

/** Renders the selected node's commands from its narrow store slice. */
export function FlowNodeToolbar({
  generationReadiness,
  nodeId,
}: {
  generationReadiness?: 'incomplete' | 'invalid' | 'ready'
  nodeId: string
}) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const node = useCanvasStore(
    state => state.nodes.find(candidate => candidate.id === nodeId),
  )

  if (!node)
    return null

  const locked = node.data.locked === true
  const generationToolbar = getFlowDashboardNodeDefinition(
    node.type,
  ).generationToolbar
  const generationActions = generationToolbar?.actions ?? []

  return (
    <NodeToolbar
      className="
        nodrag nopan flex items-center gap-1 rounded-xl border border-border/90
        bg-card/96 p-1 shadow-xl backdrop-blur-sm
      "
      nodeId={nodeId}
      offset={10}
      position={Position.Top}
    >
      <FlowNodeToolbarActions nodeId={nodeId}>
        {generationToolbar && (
          <>
            <FlowGenerationToolbarActions
              canRun={generationReadiness === 'ready'}
              nodeId={nodeId}
            />
            <FlowGenerationOutputToolbarActions
              actions={generationActions}
              nodeId={nodeId}
            />
          </>
        )}
        {node.type === 'asset' && <FlowAssetToolbarActions nodeId={nodeId} />}
      </FlowNodeToolbarActions>
      <FlowToolbarButton
        icon={locked ? IconLockOpen : IconLock}
        label={t(
          locked ? 'flows.nodeToolbar.unlock' : 'flows.nodeToolbar.lock',
        )}
        pressed={locked}
        onClick={() =>
          updateCanvasNodeData({
            referenceData: runtime.referenceData,
            store,
          }, nodeId, current => ({ ...current, locked: !locked }))}
      />
    </NodeToolbar>
  )
}
