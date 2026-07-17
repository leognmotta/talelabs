/** Executable input counts derived from mock runtime collections and slots. */

import type { GenerationInputSlotDefinition } from '@talelabs/flows'
import type { FlowMockRequestResolver } from './flow-mock-runtime-output'
import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import { isGenerationNodeType, valueTypesToAssetTypes } from '@talelabs/flows'
import { getFlowInputState } from '../../generation/flow-input-state'
import { incomingMockRuntimeEdges } from './flow-mock-runtime-edges'
import { currentMockRuntimeOutput } from './flow-mock-runtime-output'

/** Counts executable outer runtime items available through one typed input slot. */
export function executableMockRuntimeInputCount(
  state: FlowMockRuntimeState,
  nodeId: string,
  slot: GenerationInputSlotDefinition,
  visiting: ReadonlySet<string>,
  resolveRequest: FlowMockRequestResolver,
) {
  const target = state.nodesById.get(nodeId)
  if (!target)
    return 0
  const acceptsAssets = valueTypesToAssetTypes(slot.accepts).length > 0
  let staticInput = 0
  if (acceptsAssets) {
    staticInput = getFlowInputState({
      edges: [...state.input.edges],
      nodeId,
      nodes: [...state.input.nodes],
      referenceData: state.input.referenceData,
      slotId: slot.id,
    })?.selectedAvailableCount ?? 0
  }
  let runtimeCount = staticInput

  for (const edge of incomingMockRuntimeEdges(state, nodeId)) {
    if (edge.targetHandle !== slot.id)
      continue
    const source = state.nodesById.get(edge.source)
    if (!source)
      continue
    if (source.type === 'text') {
      if (
        slot.accepts.includes('Text')
        && String(source.data.text ?? '').trim().length > 0
      ) {
        runtimeCount += 1
      }
      continue
    }
    if (!isGenerationNodeType(source.type))
      continue
    const output = currentMockRuntimeOutput(
      state,
      source.id,
      visiting,
      resolveRequest,
    )
    if (output && slot.accepts.includes(output.valueType))
      runtimeCount += 1
  }

  return runtimeCount
}
