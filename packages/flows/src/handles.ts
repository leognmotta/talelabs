import type {
  FlowAssetType,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowHandleDefinition,
  FlowValueType,
} from './types.js'
import {
  getActiveGenerationInputSlots,
  getGenerationModel,
  isGenerationNodeType,
} from './generation-registry.js'
import {
  getFlowNodeTypeDefinition,
  isFlowNodeType,
} from './node-registry.js'

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

export function valueTypesToAssetTypes(
  valueTypes: readonly FlowValueType[],
) {
  return [...new Set(valueTypes.flatMap(valueTypeToAssetTypes))]
}

export function getFlowNodeHandles(
  node: FlowGraphNode,
  context: FlowGraphValidationContext,
): FlowHandleDefinition[] {
  if (!isFlowNodeType(node.type))
    return []

  const staticHandles = [
    ...getFlowNodeTypeDefinition(node.type).staticHandles,
  ]

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

  if (node.type === 'element' && node.elementId) {
    const roles = context.elementRolesById[node.elementId] ?? []
    return [
      ...staticHandles,
      {
        direction: 'output',
        id: 'context',
        maxConnections: null,
        minConnections: 0,
        valueTypes: ['ElementContext'],
      },
      ...roles.map(role => ({
        direction: 'output' as const,
        id: `role:${role.id}`,
        maxConnections: null,
        minConnections: 0,
        valueTypes: [role.valueType] as const,
      })),
    ]
  }

  if (isGenerationNodeType(node.type)) {
    const modelId = typeof node.data.modelId === 'string' ? node.data.modelId : ''
    const model = getGenerationModel(
      modelId,
      node.data.modelContractVersion,
    )
    if (!model)
      return staticHandles

    return [
      ...staticHandles,
      ...getActiveGenerationInputSlots(model, node.data.operationId).map(slot => ({
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
  return source.direction === 'output'
    && target.direction === 'input'
    && source.valueTypes.some(type => target.valueTypes.includes(type))
}
