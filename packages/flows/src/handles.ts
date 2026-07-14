import type {
  FlowAssetType,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowHandleDefinition,
  FlowValueType,
} from './types.js'
import {
  getActiveGenerationInputSlots,
  getGenerationInputSlotsForNodeType,
  getGenerationModel,
  isAdaptiveGenerationNodeType,
  isGenerationNodeType,
} from './generation-registry.js'
import { getFlowNodeTypeDefinition, isFlowNodeType } from './node-registry.js'

export function assetTypeToValueType(type: string): FlowValueType {
  if (type === 'image')
    return 'ImageSet'
  if (type === 'video')
    return 'VideoSet'
  if (type === 'audio')
    return 'AudioSet'
  return 'Asset'
}

export function valueTypeToAssetTypes(
  valueType: FlowValueType,
): readonly FlowAssetType[] {
  if (valueType === 'ImageSet')
    return ['image']
  if (valueType === 'VideoSet')
    return ['video']
  if (valueType === 'AudioSet')
    return ['audio']
  if (valueType === 'Asset')
    return ['image', 'video', 'audio', 'document']
  return []
}

export function valueTypesToAssetTypes(valueTypes: readonly FlowValueType[]) {
  return [...new Set(valueTypes.flatMap(valueTypeToAssetTypes))]
}

export function getFlowNodeHandles(
  node: FlowGraphNode,
  context: FlowGraphValidationContext,
): FlowHandleDefinition[] {
  if (!isFlowNodeType(node.type))
    return []

  const staticHandles = [...getFlowNodeTypeDefinition(node.type).staticHandles]

  if (node.type === 'asset' && node.assetId) {
    const assetType = context.assetTypesById[node.assetId]
    return [
      ...staticHandles,
      {
        direction: 'output',
        id: 'asset',
        maxConnections: null,
        minConnections: 0,
        valueTypes: [assetTypeToValueType(assetType ?? 'document')],
      },
    ]
  }

  if (isGenerationNodeType(node.type)) {
    const modelId
      = typeof node.data.modelId === 'string' ? node.data.modelId : ''
    const model = getGenerationModel(modelId, node.data.modelContractVersion)
    if (!model)
      return staticHandles

    const inputSlots = isAdaptiveGenerationNodeType(node.type)
      ? getGenerationInputSlotsForNodeType(model, node.type)
      : getActiveGenerationInputSlots(model, node.data.operationId)
    return [
      ...staticHandles,
      ...inputSlots.map(slot => ({
        direction: 'input' as const,
        id: slot.id,
        maxConnections: slot.maxConnections,
        maxItems: slot.maxItems,
        minConnections: slot.minConnections,
        valueTypes: slot.accepts,
      })),
    ]
  }

  return staticHandles
}

export function areHandlesCompatible(
  source: FlowHandleDefinition,
  target: FlowHandleDefinition,
) {
  return (
    source.direction === 'output'
    && target.direction === 'input'
    && source.valueTypes.some(type => target.valueTypes.includes(type))
  )
}
