/** Executable input counts derived from mock runtime collections and slots. */

import type {
  GenerationInputSlotDefinition,
  PromptTemplateInput,
} from '@talelabs/flows'
import type { FlowMockRequestResolver } from './flow-mock-runtime-output'
import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import {
  generationOutputCount,
  isGenerationNodeType,
  valueTypesToAssetTypes,
} from '@talelabs/flows'
import { canvasNodeToGraphNode } from '../../editor/persistence/flow-node-serialization'
import { getCanvasGenerationModel } from '../../generation/flow-generation-contract'
import { getFlowInputState } from '../../generation/flow-input-state'
import { incomingMockRuntimeEdges } from './flow-mock-runtime-edges'
import {
  currentMockRuntimeOutput,
  currentMockRuntimeOutputs,
} from './flow-mock-runtime-output'

/** Resolves prompt-addressable selected media in exact slot order. */
export function promptMockRuntimeInputs(
  state: FlowMockRuntimeState,
  nodeId: string,
  slots: readonly GenerationInputSlotDefinition[],
  visiting: ReadonlySet<string>,
  resolveRequest: FlowMockRequestResolver,
): PromptTemplateInput[] {
  const result: PromptTemplateInput[] = []
  const incoming = incomingMockRuntimeEdges(state, nodeId)
  for (const slot of slots) {
    const acceptedMedia = new Set(valueTypesToAssetTypes(slot.accepts))
    if (acceptedMedia.size === 0)
      continue
    const inputState = getFlowInputState({
      edges: [...state.input.edges],
      nodeId,
      nodes: [...state.input.nodes],
      referenceData: state.input.referenceData,
      slotId: slot.id,
    })
    const selectedAssetIds = new Set(inputState?.selectedAssetIds ?? [])
    const manual = inputState?.mode === 'manual'
    const selectedForSlot: PromptTemplateInput[] = []
    for (const edge of incoming) {
      if (edge.targetHandle !== slot.id || selectedForSlot.length >= slot.maxItems)
        continue
      for (const candidate of inputState?.candidates ?? []) {
        if (
          candidate.sourceId !== edge.source
          || !selectedAssetIds.has(candidate.assetId)
          || candidate.mediaType === 'document'
          || selectedForSlot.length >= slot.maxItems
        ) {
          continue
        }
        selectedForSlot.push({
          assetId: candidate.assetId,
          itemKey: null,
          mediaType: candidate.mediaType,
          slotId: slot.id,
          sourceNodeId: edge.source,
        })
      }
      const source = state.nodesById.get(edge.source)
      if (!source || !isGenerationNodeType(source.type))
        continue
      const outputs = currentMockRuntimeOutputs(
        state,
        source.id,
        visiting,
        resolveRequest,
      )
      if (outputs.length === 0 && !manual) {
        const model = getCanvasGenerationModel(source)
        if (
          !model
          || model.mediaType === 'text'
          || !acceptedMedia.has(model.mediaType)
        ) {
          break
        }
        const outputCount = generationOutputCount(canvasNodeToGraphNode(source))
        for (let remaining = outputCount; remaining > 0; remaining -= 1) {
          if (selectedForSlot.length >= slot.maxItems)
            break
          selectedForSlot.push({
            assetId: null,
            itemKey: null,
            mediaType: model.mediaType,
            slotId: slot.id,
            sourceNodeId: source.id,
          })
        }
        continue
      }
      for (const output of outputs) {
        if (
          output.kind !== 'media'
          || !acceptedMedia.has(output.mediaType)
          || selectedForSlot.length >= slot.maxItems
          || (manual && (!output.assetId || !selectedAssetIds.has(output.assetId)))
        ) {
          continue
        }
        selectedForSlot.push({
          assetId: output.assetId ?? null,
          itemKey: null,
          mediaType: output.mediaType,
          slotId: slot.id,
          sourceNodeId: source.id,
        })
      }
    }
    result.push(...selectedForSlot)
  }
  return result
}

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
