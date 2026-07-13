import type { FlowValueType } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'
import type {
  CanvasEdge,
  CanvasNode,
  FlowCandidate,
  FlowInputState,
  FlowReferenceData,
} from './flow-canvas-types'

import {
  compareFlowEdgesByPriority,
  getActiveGenerationInputSlots,
  getGenerationModel,
  isGenerationNodeType,
  valueTypesToAssetTypes,
} from '@talelabs/flows'

function acceptedAssetTypes(valueTypes: readonly FlowValueType[]) {
  return new Set(valueTypesToAssetTypes(valueTypes))
}

function isUsableReferenceAsset(asset: FlowReferenceAsset) {
  return asset.processingState === 'ready'
    && asset.lifecycle !== 'purging'
    && asset.lifecycle !== 'purged'
}

export function getFlowInputState(input: {
  edges: CanvasEdge[]
  nodeId: string
  nodes: CanvasNode[]
  referenceData: FlowReferenceData
  slotId: string
}): FlowInputState | null {
  const targetNode = input.nodes.find(node => node.id === input.nodeId)
  if (!targetNode || !isGenerationNodeType(targetNode.type))
    return null
  const model = getGenerationModel(
    String(targetNode.data.modelId ?? ''),
    targetNode.data.modelContractVersion,
  )
  const slot = model
    ? getActiveGenerationInputSlots(model, targetNode.data.operationId)
        .find(item => item.id === input.slotId)
    : undefined
  if (!slot)
    return null

  const incomingEdges = input.edges.filter(edge => (
    edge.target === targetNode.id && edge.targetHandle === slot.id
  )).toSorted(compareFlowEdgesByPriority)
  const acceptedTypes = acceptedAssetTypes(slot.accepts)
  const candidates: FlowCandidate[] = []
  const seenAssetIds = new Set<string>()
  let invalidDirectAssetConnection = false

  for (const edge of incomingEdges) {
    const sourceNode = input.nodes.find(node => node.id === edge.source)
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
      if (seenAssetIds.has(asset.id))
        continue
      seenAssetIds.add(asset.id)
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

    if (
      sourceNode.type !== 'element'
      || !sourceNode.elementId
      || !edge.sourceHandle?.startsWith('role:')
    ) {
      continue
    }

    const element = input.referenceData.elementsById.get(sourceNode.elementId)
    const kit = input.referenceData.elementKitsById.get(sourceNode.elementId) ?? []
    const roleId = edge.sourceHandle.slice('role:'.length)
    const links = kit
      .filter(link => (
        link.role === roleId
        && acceptedTypes.has(link.asset.type)
        && isUsableReferenceAsset(link.asset)
      ))
      .toSorted((left, right) => (
        Number(right.isPrimary) - Number(left.isPrimary)
        || left.sortOrder - right.sortOrder
        || left.assetId.localeCompare(right.assetId)
      ))
    for (const link of links) {
      if (seenAssetIds.has(link.assetId))
        continue
      seenAssetIds.add(link.assetId)
      candidates.push({
        assetId: link.assetId,
        isPrimary: link.isPrimary,
        mediaType: link.asset.type,
        name: link.asset.name,
        sourceId: sourceNode.id,
        sourceName: element?.name ?? link.role,
        sortOrder: link.sortOrder,
        thumbnailUrl: link.asset.thumbnailUrl,
      })
    }
  }

  const selections = targetNode.data.inputSelections
  const selection = selections
    && !Array.isArray(selections)
    && typeof selections === 'object'
    ? selections[slot.id]
    : undefined
  const manual = selection
    && !Array.isArray(selection)
    && typeof selection === 'object'
    && selection.mode === 'manual'
    && Array.isArray(selection.assetIds)
  const manualAssetIds: string[] = manual
    ? selection.assetIds.filter((assetId: unknown): assetId is string => (
        typeof assetId === 'string'
      ))
    : []
  const selectedAssetIds: string[] = manual
    ? manualAssetIds
    : candidates.slice(0, slot.maxItems).map(candidate => candidate.assetId)
  const candidateIds = new Set(candidates.map(candidate => candidate.assetId))
  const unavailableAssetIds = manual
    ? selectedAssetIds.filter(assetId => !candidateIds.has(assetId))
    : []
  const selectedAvailableCount = selectedAssetIds.filter(assetId => (
    candidateIds.has(assetId)
  )).length
  const invalid = invalidDirectAssetConnection || Boolean(manual && (
    selectedAvailableCount > slot.maxItems
    || unavailableAssetIds.length > 0
  ))

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
