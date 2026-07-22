/** Provider-shaped mock request projection for one executable generation node. */

import type { GenerationMockRequest } from '../../generation/flow-generation-preview-request'
import type { FlowMockRuntimeState } from './flow-mock-runtime-state'

import {
  coercePromptTemplate,
  isGenerationNodeType,
  resolveAdaptiveGenerationState,
  resolvePromptTemplate,
} from '@talelabs/flows'
import { getCanvasGenerationModel } from '../../generation/flow-generation-contract'
import {
  createLlmMockRequest,
  createMediaMockRequest,
} from '../../generation/flow-generation-preview-request'
import { getFlowInputState } from '../../generation/flow-input-state'
import { incomingMockRuntimeEdges } from './flow-mock-runtime-edges'
import {
  executableMockRuntimeInputCount,
  promptMockRuntimeInputs,
} from './flow-mock-runtime-inputs'
import { generationInputSlots } from './flow-mock-runtime-node-scope'
import {
  connectedMockRuntimeText,
  currentMockRuntimeOutput,
} from './flow-mock-runtime-output'

/** Recursively resolves one generation request, memoizing results and rejecting cycles. */
export function createMockRuntimeRequest(
  state: FlowMockRuntimeState,
  nodeId: string,
  visiting: ReadonlySet<string> = new Set(),
): GenerationMockRequest | null {
  if (state.requestCache.has(nodeId))
    return state.requestCache.get(nodeId) ?? null
  if (visiting.has(nodeId))
    return null
  const node = state.nodesById.get(nodeId)
  if (!node || !isGenerationNodeType(node.type))
    return null
  const model = getCanvasGenerationModel(node)
  if (!model)
    return null

  const resolveRequest = createMockRuntimeRequest.bind(null, state)
  const nextVisiting = new Set(visiting).add(nodeId)
  const incoming = incomingMockRuntimeEdges(state, nodeId)
  const connectionCounts: Record<string, number> = {}
  for (const edge of incoming) {
    const slotId = edge.targetHandle!
    connectionCounts[slotId] = (connectionCounts[slotId] ?? 0) + 1
  }
  const slots = generationInputSlots(node)
  const connectedText = Object.fromEntries(
    ['instructions', 'lyrics', 'prompt'].map(slotId => [
      slotId,
      connectedMockRuntimeText(
        state,
        nodeId,
        slotId,
        nextVisiting,
        resolveRequest,
      ),
    ]),
  )
  const promptResolution = connectedText.prompt === null
    ? resolvePromptTemplate({
        inputs: promptMockRuntimeInputs(
          state,
          nodeId,
          slots,
          nextVisiting,
          resolveRequest,
        ),
        template: coercePromptTemplate(node.data.prompt),
      })
    : null
  if (promptResolution && !promptResolution.ok) {
    state.requestCache.set(nodeId, null)
    return null
  }
  const textInputs = {
    instructions: connectedText.instructions
      ?? String(node.data.instructions ?? ''),
    lyrics: connectedText.lyrics ?? String(node.data.lyrics ?? ''),
    prompt: connectedText.prompt ?? promptResolution?.resolvedText ?? '',
  }
  const itemCounts = Object.fromEntries(slots.map(slot => [
    slot.id,
    ['instructions', 'lyrics', 'prompt'].includes(slot.id)
      ? (String((textInputs as Record<string, string>)[slot.id] ?? '').trim().length > 0 ? 1 : 0)
      : executableMockRuntimeInputCount(
          state,
          nodeId,
          slot,
          nextVisiting,
          resolveRequest,
        ),
  ]))

  let request: GenerationMockRequest | null
  if (node.type === 'llm') {
    const imageState = getFlowInputState({
      edges: [...state.input.edges],
      nodeId,
      nodes: [...state.input.nodes],
      referenceData: state.input.referenceData,
      slotId: 'imageReferences',
    })
    const availableImageIds = new Set(
      imageState?.candidates.map(candidate => candidate.assetId) ?? [],
    )
    const imageAssetIds = (imageState?.selectedAssetIds ?? [])
      .filter(assetId => availableImageIds.has(assetId))
      .slice(0, imageState?.maximum ?? 8)
    request = createLlmMockRequest({
      connectionCounts,
      imageAssetIds,
      instructions: textInputs.instructions ?? '',
      itemCounts,
      locale: state.input.locale,
      model,
      node,
      prompt: textInputs.prompt ?? '',
    })
  }
  else {
    const resolution = resolveAdaptiveGenerationState({
      connectionCounts,
      inlineInstructions: textInputs.instructions ?? '',
      inlineLyrics: textInputs.lyrics ?? '',
      inlinePrompt: textInputs.prompt ?? '',
      itemCounts,
      model,
      nodeType: node.type,
      settings: node.data.settings ?? {},
    })
    if (resolution && (
      resolution.readiness !== 'ready'
      || !resolution.resolvedOperationId
    )) {
      state.requestCache.set(nodeId, null)
      return null
    }
    const settings = resolution && 'normalizedSettings' in resolution
      ? resolution.normalizedSettings
      : node.data.settings ?? {}
    const connectedSources = incoming.map((edge) => {
      const source = state.nodesById.get(edge.source)
      const output = source && isGenerationNodeType(source.type)
        ? currentMockRuntimeOutput(
            state,
            source.id,
            nextVisiting,
            resolveRequest,
          )
        : null
      const sourceValue = source?.type === 'text'
        ? String(source.data.text ?? '')
        : output
          ? state.input.previews[source!.id]?.fingerprint ?? ''
          : source?.assetId ?? ''
      return [
        edge.source,
        edge.sourceHandle ?? '',
        edge.targetHandle ?? '',
        sourceValue,
      ].join(':')
    })
    const inputAssetIds = slots.flatMap(slot => (
      getFlowInputState({
        edges: [...state.input.edges],
        nodeId,
        nodes: [...state.input.nodes],
        referenceData: state.input.referenceData,
        slotId: slot.id,
      })?.selectedAssetIds ?? []
    ))
    request = createMediaMockRequest({
      connectedSources,
      connectionCounts,
      inputAssetIds,
      itemCounts,
      locale: state.input.locale,
      model,
      node,
      operationId:
        resolution?.resolvedOperationId
        ?? String(node.data.operationId ?? ''),
      settings,
      textInputs,
    })
  }

  state.requestCache.set(nodeId, request)
  return request
}
