import type { FlowHandleDefinition, FlowValueType } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { FlowCanvasContextValue } from './flow-canvas-context'
import type { CanvasNode } from './flow-canvas-types'

import { isGenerationNodeType } from '@talelabs/flows'
import { FLOW_DASHBOARD_NODE_REGISTRY } from './flow-dashboard-node-registry'
import { getCanvasGenerationModel } from './flow-generation-contract'

export interface PortPreviewItem {
  asset?: FlowReferenceAsset
  assetId?: FlowReferenceAsset['id']
  id: string
  mediaType?: 'audio' | 'image' | 'video'
  mimeType?: string
  name: string
  previewUrl?: string
  text?: string
  valueType: FlowValueType
}

export function valueTypeLabel(valueType: FlowValueType, t: TFunction) {
  const keys = {
    Asset: 'flows.outputs.asset',
    AudioSet: 'assets.types.audio',
    ElementContext: 'flows.outputs.elementContext',
    ImageSet: 'assets.types.image',
    Text: 'flows.outputs.text',
    VideoSet: 'assets.types.video',
  } as const
  return t(keys[valueType])
}

export function flowNodeHandleLabel(
  handle: FlowHandleDefinition,
  node: CanvasNode,
  t: TFunction,
  _canvas: FlowCanvasContextValue,
) {
  if (isGenerationNodeType(node.type)) {
    const model = getCanvasGenerationModel(node)
    const slot = model?.inputSlots.find(item => item.id === handle.id)
    if (slot)
      return t(slot.labelKey)
  }

  const standardLabels: Partial<Record<string, string>> = {
    asset: 'flows.outputs.asset',
    audio: 'flows.outputs.audio',
    images: 'flows.outputs.images',
    text: 'flows.outputs.text',
    videos: 'flows.outputs.videos',
  }
  const standardLabel = standardLabels[handle.id]
  if (standardLabel)
    return t(standardLabel)

  return handle.id
}

export function flowNodeName(
  node: CanvasNode,
  t: TFunction,
  canvas: FlowCanvasContextValue,
) {
  if (node.type === 'asset' && node.assetId) {
    return canvas.referenceData.assetsById.get(node.assetId)?.name
      ?? t('flows.nodes.asset')
  }
  if (isGenerationNodeType(node.type)) {
    const model = getCanvasGenerationModel(node)
    return model ? t(model.labelKey) : t(`flows.nodes.${node.type}`)
  }
  return t(FLOW_DASHBOARD_NODE_REGISTRY[node.type].labelKey)
}
