/** Projection of exact selected canvas media inputs into prompt suggestions. */

import type {
  GenerationInputSlotDefinition,
  PromptTemplateMediaType,
} from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type { PromptComposerInput } from '../../../../generation/prompt-composer/prompt-composer-types'
import type {
  CanvasEdge,
  CanvasNode,
  FlowGenerationPreviewOutput,
} from '../../../editor/flow-canvas-types'
import type { FlowNodePortCanvas } from '../ports/flow-node-port-preview'

import {
  compareFlowEdgesByPriority,
  generationOutputCount,
  isGenerationNodeType,
} from '@talelabs/flows'
import { canvasNodeToGraphNode } from '../../../editor/persistence/flow-node-serialization'
import { getCanvasGenerationModel } from '../../../generation/flow-generation-contract'
import { flowNodeName } from '../ports/flow-node-port-preview'

interface PromptableOutput {
  assetId?: string
  mediaType: PromptTemplateMediaType
  name: string
  previewUrl: null | string
}

const VALUE_TYPE_BY_MEDIA = {
  audio: 'AudioSet',
  image: 'ImageSet',
  video: 'VideoSet',
} as const

function promptableGenerationOutputs(input: {
  canvas: FlowNodePortCanvas
  node: CanvasNode
  slot: GenerationInputSlotDefinition
  t: TFunction
}): PromptableOutput[] {
  const preview = input.canvas.getGenerationPreview(input.node.id)
  if (!preview?.output) {
    const model = getCanvasGenerationModel(input.node)
    if (!model || model.mediaType === 'text')
      return []
    const mediaType = model.mediaType
    if (!input.slot.accepts.includes(VALUE_TYPE_BY_MEDIA[mediaType]))
      return []
    return Array.from(
      { length: generationOutputCount(canvasNodeToGraphNode(input.node)) },
      () => ({
        mediaType,
        name: flowNodeName(input.node, input.t, input.canvas),
        previewUrl: null,
      }),
    )
  }
  const collections: FlowGenerationPreviewOutput[][] = preview.resultSets?.length
    ? preview.resultSets.map(resultSet => (
        resultSet.outputs.map(result => result.output)
      ))
    : [[preview.output]]
  const promptableCollections = collections.map(collection => collection.filter(
    output => output.kind === 'media' && input.slot.accepts.includes(output.valueType),
  ))
  const commonLength = Math.min(...promptableCollections.map(items => items.length))
  const result: PromptableOutput[] = []
  for (let index = 0; index < commonLength; index += 1) {
    const representative = promptableCollections[0]?.[index]
    if (
      !representative
      || representative.kind !== 'media'
      || !promptableCollections.every((collection) => {
        const candidate = collection[index]
        return candidate?.kind === 'media'
          && candidate.mediaType === representative.mediaType
      })
    ) {
      return []
    }
    result.push({
      ...(representative.assetId ? { assetId: representative.assetId } : {}),
      mediaType: representative.mediaType,
      name: representative.name,
      previewUrl: representative.download.content.trimStart().startsWith('<')
        ? null
        : representative.download.content,
    })
  }
  return result
}

/** Builds effective selected media values in stable slot and source order. */
export function generationPromptInputs(input: {
  canvas: FlowNodePortCanvas
  edges: readonly CanvasEdge[]
  node: CanvasNode
  slots: readonly GenerationInputSlotDefinition[]
  t: TFunction
}): PromptComposerInput[] {
  const incomingEdges = input.edges
    .filter(edge => edge.target === input.node.id && edge.targetHandle)
    .toSorted(compareFlowEdgesByPriority)
  return input.slots.flatMap((slot) => {
    if (!slot.accepts.some(valueType => valueType !== 'Text'))
      return []
    const inputState = input.canvas.getInputState(input.node.id, slot.id)
    const selectedAssetIds = new Set(inputState?.selectedAssetIds ?? [])
    const manual = inputState?.mode === 'manual'
    const selected: Omit<PromptComposerInput, 'index' | 'slotId'>[] = []
    for (const edge of incomingEdges) {
      if (edge.targetHandle !== slot.id || selected.length >= slot.maxItems)
        continue
      const directCandidates = (inputState?.candidates ?? []).filter(candidate => (
        candidate.sourceId === edge.source
        && selectedAssetIds.has(candidate.assetId)
        && candidate.mediaType !== 'document'
      ))
      if (directCandidates.length > 0) {
        for (const candidate of directCandidates) {
          if (selected.length >= slot.maxItems)
            break
          const asset = input.canvas.referenceData.assetsById.get(candidate.assetId)
          selected.push({
            mediaType: candidate.mediaType as PromptTemplateMediaType,
            name: candidate.name,
            previewUrl: candidate.thumbnailUrl ?? asset?.url ?? null,
          })
        }
        continue
      }
      const source = input.canvas.getNode(edge.source)
      if (!source || !isGenerationNodeType(source.type))
        continue
      const outputs = promptableGenerationOutputs({
        canvas: input.canvas,
        node: source,
        slot,
        t: input.t,
      })
      if (outputs.length === 0 && !manual)
        break
      for (const output of outputs) {
        if (
          selected.length >= slot.maxItems
          || (manual && (!output.assetId || !selectedAssetIds.has(output.assetId)))
        ) {
          continue
        }
        selected.push({
          mediaType: output.mediaType,
          name: output.name,
          previewUrl: output.mediaType === 'image' ? output.previewUrl : null,
        })
      }
    }
    return selected.map((item, index) => ({
      ...item,
      index,
      slotId: slot.id,
    }))
  })
}
