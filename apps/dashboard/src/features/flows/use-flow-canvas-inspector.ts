import type {
  CanvasNode,
  FlowReferenceData,
} from './flow-canvas-types'

import { useMemo } from 'react'
import { getFlowDashboardNodeDefinition } from './flow-dashboard-node-registry'

export function useFlowCanvasInspector(input: {
  getNode: (nodeId: string) => CanvasNode | undefined
  referenceData: FlowReferenceData
  selectedNodeIds: string[]
}) {
  const {
    getNode,
    referenceData,
    selectedNodeIds,
  } = input
  const selectedNode = selectedNodeIds.length === 1
    ? getNode(selectedNodeIds[0]!)
    : undefined
  const selectedNodeDefinition = selectedNode
    ? getFlowDashboardNodeDefinition(selectedNode.type)
    : undefined
  const selectedAsset = useMemo(() => {
    if (
      selectedNodeDefinition?.inspector !== 'assetMetadata'
      || !selectedNode?.assetId
    ) {
      return undefined
    }
    return referenceData.assetsById.get(selectedNode.assetId)
  }, [referenceData.assetsById, selectedNode, selectedNodeDefinition])
  const selectedGenerationNode = selectedNodeDefinition?.inspector
    === 'generationSettings'
    ? selectedNode
    : undefined
  return {
    selectedAsset,
    selectedGenerationNode,
    selectedNode,
  }
}
