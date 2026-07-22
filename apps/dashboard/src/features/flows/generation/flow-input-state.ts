/** Derived connection, candidate, and selection state for one generation input. */

import type { FlowValueType } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'
import type {
  CanvasEdge,
  CanvasNode,
  FlowCandidate,
  FlowInputState,
  FlowReferenceData,
} from '../editor/flow-canvas-types'

import {
  compareFlowEdgesByPriority,
  getActiveGenerationInputSlots,
  getGenerationInputSlotsForNodeType,
  getGenerationModel,
  isAdaptiveGenerationNodeType,
  isGenerationNodeType,
  valueTypesToAssetTypes,
} from '@talelabs/flows'

function acceptedAssetTypes(valueTypes: readonly FlowValueType[]) {
  return new Set(valueTypesToAssetTypes(valueTypes))
}

function isUsableReferenceAsset(asset: FlowReferenceAsset) {
  return (
    asset.processingState === 'ready'
    && asset.lifecycle !== 'purging'
    && asset.lifecycle !== 'purged'
  )
}

type FlowInputStateSource
  = | {
    edges: readonly CanvasEdge[]
    nodeId: string
    nodes: readonly CanvasNode[]
  }
  | {
    incomingEdges: readonly CanvasEdge[]
    nodesById: ReadonlyMap<string, CanvasNode>
    targetNode: CanvasNode
  }

/** Projects one slot from either raw graph arrays or a shared indexed graph. */
export function getFlowInputState(input: FlowInputStateSource & {
  referenceData: FlowReferenceData
  slotId: string
}): FlowInputState | null {
  const indexed = 'targetNode' in input
  const targetNode = indexed
    ? input.targetNode
    : input.nodes.find(node => node.id === input.nodeId)
  if (!targetNode || !isGenerationNodeType(targetNode.type))
    return null
  const model = getGenerationModel(
    String(targetNode.data.modelId ?? ''),
    targetNode.data.modelContractVersion,
  )
  const slot = model
    ? (isAdaptiveGenerationNodeType(targetNode.type)
        ? getGenerationInputSlotsForNodeType(model, targetNode.type)
        : getActiveGenerationInputSlots(model, targetNode.data.operationId)
      ).find(item => item.id === input.slotId)
    : undefined
  if (!slot)
    return null

  const incomingEdges = (indexed ? input.incomingEdges : input.edges)
    .filter(
      edge => edge.target === targetNode.id && edge.targetHandle === slot.id,
    )
    .toSorted(compareFlowEdgesByPriority)
  const acceptedTypes = acceptedAssetTypes(slot.accepts)
  const candidates: FlowCandidate[] = []
  let invalidDirectAssetConnection = false

  for (const edge of incomingEdges) {
    const sourceNode = indexed
      ? input.nodesById.get(edge.source)
      : input.nodes.find(node => node.id === edge.source)
    if (!sourceNode)
      continue

    if (sourceNode.type === 'asset') {
      if (!sourceNode.assetId) {
        invalidDirectAssetConnection = true
        continue
      }
      const asset = input.referenceData.assetsById.get(sourceNode.assetId)
      if (
        !asset
        || !acceptedTypes.has(asset.type)
        || !isUsableReferenceAsset(asset)
      ) {
        invalidDirectAssetConnection = true
        continue
      }
      candidates.push({
        assetId: asset.id,
        isPrimary: true,
        mediaType: asset.type,
        name: asset.name,
        sourceId: sourceNode.id,
        sourceName: asset.name,
        sortOrder: 0,
        thumbnailUrl: asset.thumbnailUrl,
      })
      continue
    }

    if (sourceNode.type === 'element') {
      const elementId = typeof sourceNode.data.elementId === 'string'
        ? sourceNode.data.elementId
        : null
      const element = elementId
        ? input.referenceData.elementsById.get(elementId)
        : undefined
      if (!element)
        continue
      const rawSelected = sourceNode.data.selectedAssetIds
      const chosenIds = new Set<string>(
        Array.isArray(rawSelected)
          ? rawSelected.filter(
              (item: unknown): item is string => typeof item === 'string',
            )
          : [],
      )
      if (
        [...chosenIds].some(assetId =>
          !element.referenceAssetIds.includes(assetId))
      ) {
        invalidDirectAssetConnection = true
      }
      const emittedAssetIds = element.referenceAssetIds
        .filter(assetId => chosenIds.has(assetId))
      for (const [index, assetId] of emittedAssetIds.entries()) {
        const asset = input.referenceData.assetsById.get(assetId)
        if (
          !asset
          || !acceptedTypes.has(asset.type)
          || !isUsableReferenceAsset(asset)
        ) {
          continue
        }
        candidates.push({
          assetId: asset.id,
          isPrimary: index === 0,
          mediaType: asset.type,
          name: asset.name,
          sourceId: sourceNode.id,
          sourceName: element.name,
          sortOrder: index,
          thumbnailUrl: asset.thumbnailUrl,
        })
      }
      continue
    }
  }

  const selections = targetNode.data.inputSelections
  const selection
    = selections && !Array.isArray(selections) && typeof selections === 'object'
      ? selections[slot.id]
      : undefined
  const manual
    = selection
      && !Array.isArray(selection)
      && typeof selection === 'object'
      && selection.mode === 'manual'
      && Array.isArray(selection.assetIds)
  const manualAssetIds: string[] = manual
    ? selection.assetIds.filter(
        (assetId: unknown): assetId is string => typeof assetId === 'string',
      )
    : []
  const selectedAssetIds: string[] = manual
    ? manualAssetIds
    : candidates.slice(0, slot.maxItems).map(candidate => candidate.assetId)
  const candidateIds = new Set(
    candidates.map(candidate => candidate.assetId),
  )
  const unavailableAssetIds = manual
    ? selectedAssetIds.filter(assetId => !candidateIds.has(assetId))
    : []
  const selectedAssetIdSet = new Set(selectedAssetIds)
  const selectedAvailableCount = manual
    ? candidates.filter(candidate => selectedAssetIdSet.has(candidate.assetId))
      .length
    : selectedAssetIds.length
  const invalid
    = invalidDirectAssetConnection
      || Boolean(
        manual
        && (selectedAvailableCount > slot.maxItems
          || unavailableAssetIds.length > 0),
      )

  return {
    availableCount: candidates.length,
    candidates,
    connectionCount: incomingEdges.length,
    invalid,
    maximum: slot.maxItems,
    mode: manual ? 'manual' : 'auto',
    selectedAssetIds,
    selectedAvailableCount,
    unavailableAssetIds,
  }
}
