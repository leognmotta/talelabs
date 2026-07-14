import type { TFunction } from 'i18next'
import type { RefObject } from 'react'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreview,
  FlowReferenceData,
} from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { isGenerationNodeType } from '@talelabs/flows'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  createFlowMockRuntimePlanner,
  runFlowGenerationMockPreview,
} from './flow-mock-runtime-planner'

/** Owns the complete ephemeral M4 mock-preview lifecycle for the canvas. */
export function useFlowMockRunOrchestration(input: {
  edges: readonly CanvasEdge[]
  edgesRef: RefObject<CanvasEdge[]>
  locale: string
  nodes: readonly CanvasNode[]
  nodesRef: RefObject<CanvasNode[]>
  referenceData: FlowReferenceData
  referenceDataRef: RefObject<FlowReferenceData>
  t: TFunction
}) {
  const [previews, setPreviews] = useState<
    Readonly<Record<string, FlowGenerationPreview>>
  >({})
  const previewsRef = useRef(previews)
  const planner = useMemo(() => createFlowMockRuntimePlanner({
    edges: input.edges,
    locale: input.locale,
    nodes: input.nodes,
    previews,
    referenceData: input.referenceData,
  }), [input.edges, input.locale, input.nodes, input.referenceData, previews])
  const createCurrentPlanner = useCallback(
    () => createFlowMockRuntimePlanner({
      edges: input.edgesRef.current,
      locale: input.locale,
      nodes: input.nodesRef.current,
      previews: previewsRef.current,
      referenceData: input.referenceDataRef.current,
    }),
    [input.edgesRef, input.locale, input.nodesRef, input.referenceDataRef],
  )
  const updatePreview = useCallback((
    nodeId: string,
    preview: FlowGenerationPreview,
  ) => {
    const next = { ...previewsRef.current, [nodeId]: preview }
    previewsRef.current = next
    setPreviews(next)
  }, [])
  const runSinglePreview = useCallback(async (nodeId: string) => {
    await runFlowGenerationMockPreview({
      nodeId,
      planner: createCurrentPlanner(),
      t: input.t,
      updatePreview,
    })
  }, [createCurrentPlanner, input.t, updatePreview])
  const runGenerationPreview = useCallback(async (
    nodeId: string,
    scope: FlowGenerationPreviewScope = 'node',
  ) => {
    const previewNodeIds = createCurrentPlanner().getPreviewNodeIds(nodeId, scope)
    for (const previewNodeId of previewNodeIds) {
      const node = input.nodesRef.current.find(item => item.id === previewNodeId)
      if (!node || !isGenerationNodeType(node.type))
        continue
      await runSinglePreview(previewNodeId)
    }
  }, [createCurrentPlanner, input.nodesRef, runSinglePreview])
  const runGenerationSelectionPreview = useCallback(async (
    nodeIds: readonly string[],
  ) => {
    const planner = createCurrentPlanner()
    const previewNodeIds = [...new Set(nodeIds.flatMap(
      nodeId => planner.getPreviewNodeIds(nodeId, 'tillHere'),
    ))]
    for (const previewNodeId of previewNodeIds) {
      const node = input.nodesRef.current.find(item => item.id === previewNodeId)
      if (!node || !isGenerationNodeType(node.type))
        continue
      await runSinglePreview(previewNodeId)
    }
  }, [createCurrentPlanner, input.nodesRef, runSinglePreview])

  return {
    getExecutableInputCount: planner.getExecutableInputCount,
    getGenerationPreview: (nodeId: string) => previews[nodeId],
    getGenerationPreviewFingerprint: planner.getFingerprint,
    previews,
    runGenerationPreview,
    runGenerationSelectionPreview,
  }
}
