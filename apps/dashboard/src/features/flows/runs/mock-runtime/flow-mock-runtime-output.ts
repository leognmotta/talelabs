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
  return currentMockRuntimeOutputs(
    state,
    nodeId,
    visiting,
    resolveRequest,
  )[0] ?? null
}

/** Returns every current output in provider order for prompt-input selection. */
export function currentMockRuntimeOutputs(
  state: FlowMockRuntimeState,
  nodeId: string,
  visiting: ReadonlySet<string>,
  resolveRequest: FlowMockRequestResolver,
): readonly FlowGenerationPreviewOutput[] {
  const preview = state.input.previews[nodeId]
  if (preview?.status !== 'succeeded')
    return []
  const request = resolveRequest(nodeId, visiting)
  if (!request || preview.fingerprint !== fingerprintGenerationMockRequest(request))
    return []
  if (preview.resultSets?.length) {
    const collections = preview.resultSets.map(resultSet => (
      resultSet.outputs.map(result => result.output)
    ))
    const commonLength = Math.min(...collections.map(outputs => outputs.length))
    const compatible = Array.from({ length: commonLength }, (_, index) => (
      collections.every(collection => (
        collection[index]?.kind === collections[0]?.[index]?.kind
        && collection[index]?.valueType === collections[0]?.[index]?.valueType
        && (
          collection[index]?.kind !== 'media'
          || collections[0]?.[index]?.kind !== 'media'
          || collection[index].mediaType === collections[0][index].mediaType
        )
      ))
    )).every(Boolean)
    return compatible ? collections[0]!.slice(0, commonLength) : []
  }
  return preview.output ? [preview.output] : []
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
