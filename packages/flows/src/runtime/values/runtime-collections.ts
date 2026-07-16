import type { FlowAssetType } from '../../graph/types.js'
import type {
  ActiveRuntimeValueType,
  FlowRuntimeValue,
  RuntimeAssetCollectionValue,
} from './runtime-values.js'

import { createRuntimeItem } from './runtime-items.js'

export function runtimeCollectionKindForMediaType(
  mediaType: FlowAssetType,
): RuntimeAssetCollectionValue['kind'] {
  if (mediaType === 'image')
    return 'imageSet'
  if (mediaType === 'video')
    return 'videoSet'
  if (mediaType === 'audio')
    return 'audioSet'
  return 'asset'
}

export function runtimeValueType(value: FlowRuntimeValue): ActiveRuntimeValueType {
  if (value.kind === 'text')
    return 'Text'
  if (value.kind === 'imageSet')
    return 'ImageSet'
  if (value.kind === 'videoSet')
    return 'VideoSet'
  if (value.kind === 'audioSet')
    return 'AudioSet'
  return 'Asset'
}

export function createStaticAssetItem(input: {
  assetId: string
  mediaType: FlowAssetType
  nodeId: string
}) {
  const kind = runtimeCollectionKindForMediaType(input.mediaType)
  return createRuntimeItem<RuntimeAssetCollectionValue>({
    key: `asset:${input.assetId}`,
    nodeId: input.nodeId,
    value: {
      assets: [{
        assetId: input.assetId,
        mediaType: input.mediaType,
        source: 'staticAsset',
      }],
      kind,
    } as RuntimeAssetCollectionValue,
  })
}
