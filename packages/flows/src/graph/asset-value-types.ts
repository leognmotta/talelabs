import type { FlowAssetType, FlowValueType } from './types.js'

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
