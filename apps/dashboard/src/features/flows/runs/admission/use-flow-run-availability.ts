/** Runtime availability queries for adding and executing generation nodes. */

import type { FlowNodeType } from '@talelabs/flows'
import type { GenerationConfigResponse } from '@talelabs/sdk'
import type { CanvasStore } from '../../editor/canvas-state/canvas-store'
import type { FlowGenerationPreview } from '../../editor/flow-canvas-types'

import { isGenerationNodeType } from '@talelabs/flows'
import { useCallback, useMemo } from 'react'

/** Resolves model availability and imperative run admission checks. */
export function useFlowRunAvailability(input: {
  generationConfig: GenerationConfigResponse
  getGenerationPreview: (nodeId: string) => FlowGenerationPreview | undefined
  getGenerationPreviewFingerprint: (nodeId: string) => null | string
  store: CanvasStore
}) {
  const {
    generationConfig,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    store,
  } = input
  const executableModelIds = useMemo(
    () => new Set(generationConfig.models.map(model => model.id)),
    [generationConfig.models],
  )
  const executableGenerationNodeTypes = useMemo(
    () => new Set(generationConfig.models.flatMap(model =>
      model.capabilities.operations.map(operation => operation.nodeType),
    )),
    [generationConfig.models],
  )
  const canAddNodeType = useCallback(
    (nodeType: FlowNodeType) => !isGenerationNodeType(nodeType)
      || executableGenerationNodeTypes.has(nodeType),
    [executableGenerationNodeTypes],
  )
  const getCanRunNode = useCallback((nodeId: string) => {
    const node = store.getState().nodes.find(candidate => candidate.id === nodeId)
    if (
      node
      && isGenerationNodeType(node.type)
      && !executableModelIds.has(String(node.data.modelId ?? ''))
    ) {
      return false
    }
    const previewStatus = getGenerationPreview(nodeId)?.status
    return getGenerationPreviewFingerprint(nodeId) !== null
      && previewStatus !== 'pending'
      && previewStatus !== 'queued'
  }, [
    executableModelIds,
    getGenerationPreview,
    getGenerationPreviewFingerprint,
    store,
  ])
  const hasUnavailableGenerationNode = store.getState().nodes.some(node =>
    isGenerationNodeType(node.type)
    && !executableModelIds.has(String(node.data.modelId ?? '')),
  )
  return {
    canAddNodeType,
    getCanRunNode,
    hasUnavailableGenerationNode,
  }
}
