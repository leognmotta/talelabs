/** Selected-node metadata, settings, and connection inspector composition. */

import type { FlowReferenceAsset } from '@talelabs/sdk'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'

import { memo } from 'react'
import { FlowAssetMetadataCard } from './flow-asset-metadata-card'
import { FlowGenerationSettingsCard } from './flow-generation-settings-card'
import { FlowNodeConnectionsCard } from './flow-node-connections-card'

/** Composes the inspector sections applicable to one selected node. */
export const FlowCanvasInspectorPanel = memo((input: {
  edges: CanvasEdge[]
  selectedAsset?: FlowReferenceAsset
  selectedGenerationNode?: CanvasNode
  selectedNode: CanvasNode
}) => {
  return (
    <div className="flex flex-col gap-3">
      {input.selectedAsset && (
        <FlowAssetMetadataCard asset={input.selectedAsset} />
      )}
      {input.selectedGenerationNode && (
        <FlowGenerationSettingsCard node={input.selectedGenerationNode} />
      )}
      <FlowNodeConnectionsCard
        edges={input.edges}
        node={input.selectedNode}
      />
    </div>
  )
})
