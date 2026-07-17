/** Resolves current mock outputs and connected text without mutating node data. */

import type { FlowGenerationPreviewOutput } from '../../editor/flow-canvas-types'
import type { GenerationMockRequest } from '../../generation/flow-generation-preview-request'
import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import { isGenerationNodeType } from '@talelabs/flows'
import { fingerprintGenerationMockRequest } from '../../generation/flow-generation-preview-fingerprint'
import { incomingMockRuntimeEdges } from './flow-mock-runtime-edges'

/** Cycle-aware resolver used while traversing upstream mock requests. */
export type FlowMockRequestResolver = (
  nodeId: string,
  visiting: ReadonlySet<string>,
) => GenerationMockRequest | null

/** Returns a mounted output only when it still matches the resolved request fingerprint. */
export function currentMockRuntimeOutput(
  state: FlowMockRuntimeState,
  nodeId: string,
  visiting: ReadonlySet<string>,
  resolveRequest: FlowMockRequestResolver,
): FlowGenerationPreviewOutput | null {
  const preview = state.input.previews[nodeId]
  if (preview?.status !== 'succeeded')
    return null
  if (preview.resultSets?.length)
    return preview.output
  const request = resolveRequest(nodeId, visiting)
  if (!request || preview.fingerprint !== fingerprintGenerationMockRequest(request))
    return null
  return preview.output
}

/** Resolves text supplied through one connected upstream node output. */
export function connectedMockRuntimeText(
  state: FlowMockRuntimeState,
  nodeId: string,
  slotId: string,
  visiting: ReadonlySet<string>,
  resolveRequest: FlowMockRequestResolver,
) {
  const edge = incomingMockRuntimeEdges(state, nodeId).find(
    item => item.targetHandle === slotId,
  )
  if (!edge)
    return null
  const source = state.nodesById.get(edge.source)
  if (source?.type === 'text')
    return String(source.data.text ?? '')
  if (source && isGenerationNodeType(source.type)) {
    const output = currentMockRuntimeOutput(
      state,
      source.id,
      visiting,
      resolveRequest,
    )
    return output?.kind === 'text' ? output.text : ''
  }
  return ''
}
