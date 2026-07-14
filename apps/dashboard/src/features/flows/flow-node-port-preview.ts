import type { FlowHandleDefinition, FlowValueType } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { FlowCanvasContextValue } from './flow-canvas-context'
import type { CanvasEdge, CanvasNode } from './flow-canvas-types'

import { isGenerationNodeType } from '@talelabs/flows'
import { FLOW_DASHBOARD_NODE_REGISTRY } from './flow-dashboard-node-registry'
import { getCanvasGenerationModel } from './flow-generation-contract'

export interface PortPreviewItem {
  asset?: FlowReferenceAsset
  id: string
  name: string
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

function connectedNodeName(
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

function nodePreviewItem(
  id: string,
  node: CanvasNode,
  valueType: FlowValueType,
  canvas: FlowCanvasContextValue,
  t: TFunction,
): PortPreviewItem {
  const asset = node.type === 'asset' && node.assetId
    ? canvas.referenceData.assetsById.get(node.assetId)
    : undefined
  const text = node.type === 'text' && typeof node.data.text === 'string'
    ? node.data.text.trim()
    : undefined
  return {
    ...(asset ? { asset } : {}),
    id,
    name: connectedNodeName(node, t, canvas),
    ...(text ? { text } : {}),
    valueType,
  }
}

export function inputPortPreviewItems(
  edges: CanvasEdge[],
  handle: FlowHandleDefinition,
  node: CanvasNode,
  canvas: FlowCanvasContextValue,
  t: TFunction,
) {
  const inputState = canvas.getInputState(node.id, handle.id)
  const selectedAssetIds = new Set(inputState?.selectedAssetIds ?? [])
  const representedSourceIds = new Set<string>()
  const items: PortPreviewItem[] = []

  for (const candidate of inputState?.candidates ?? []) {
    if (!selectedAssetIds.has(candidate.assetId))
      continue
    const asset = canvas.referenceData.assetsById.get(candidate.assetId)
    if (!asset)
      continue
    representedSourceIds.add(candidate.sourceId)
    items.push({
      asset,
      id: `${handle.id}:asset:${asset.id}`,
      name: asset.name,
      valueType: handle.valueTypes[0],
    })
  }

  for (const edge of edges) {
    if (
      edge.target !== node.id
      || edge.targetHandle !== handle.id
      || representedSourceIds.has(edge.source)
    ) {
      continue
    }
    const sourceNode = canvas.getNode(edge.source)
    if (!sourceNode)
      continue
    representedSourceIds.add(sourceNode.id)
    items.push(nodePreviewItem(
      `${handle.id}:connection:${edge.id}`,
      sourceNode,
      handle.valueTypes[0],
      canvas,
      t,
    ))
  }
  return items
}

export function outputPortPreviewItems(
  handle: FlowHandleDefinition,
  node: CanvasNode,
  canvas: FlowCanvasContextValue,
  t: TFunction,
) {
  const valueType = handle.valueTypes[0]
  if (node.type === 'asset' && node.assetId) {
    const asset = canvas.referenceData.assetsById.get(node.assetId)
    return asset
      ? [{ asset, id: `${handle.id}:asset:${asset.id}`, name: asset.name, valueType }]
      : []
  }
  if (node.type === 'text') {
    return [nodePreviewItem(
      `${handle.id}:text:${node.id}`,
      node,
      valueType,
      canvas,
      t,
    )]
  }
  if (isGenerationNodeType(node.type)) {
    const preview = canvas.getGenerationPreview(node.id)
    if (preview?.status !== 'succeeded' || preview.output.valueType !== valueType)
      return []
    return [{
      id: `${handle.id}:preview:${preview.fingerprint}`,
      name: preview.output.name,
      ...(preview.output.kind === 'text' ? { text: preview.output.text } : {}),
      valueType,
    }]
  }
  return []
}
