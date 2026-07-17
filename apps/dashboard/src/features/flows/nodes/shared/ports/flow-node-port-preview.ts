/** Shared contracts and labels for node connection preview presentation. */

import type { FlowHandleDefinition, FlowValueType } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'
import type { TFunction } from 'i18next'
import type { CanvasNode, FlowGenerationPreview, FlowInputState, FlowReferenceData } from '../../../editor/flow-canvas-types'

import { isGenerationNodeType } from '@talelabs/flows'
import { getCanvasGenerationModel } from '../../../generation/flow-generation-contract'
import { FLOW_NODE_METADATA } from '../../flow-node-metadata'

/** One displayable value projected from a node port. */
export interface PortPreviewItem {
  /** Canonical Asset metadata when the value resolves to an Asset. */
  asset?: FlowReferenceAsset
  /** Canonical Asset identity when a generated output has been persisted. */
  assetId?: FlowReferenceAsset['id']
  /** Stable presentation identity within the owning port. */
  id: string
  /** Media category used to select the preview renderer. */
  mediaType?: 'audio' | 'image' | 'video'
  /** Content type used when downloading or presenting generated media. */
  mimeType?: string
  /** User-facing value name. */
  name: string
  /** Browser-readable media source for a generated preview. */
  previewUrl?: string
  /** Text payload when the value is textual. */
  text?: string
  /** Typed graph value exposed by the port. */
  valueType: FlowValueType
}

/** Narrow graph and runtime queries used to render connection previews. */
export interface FlowNodePortCanvas {
  /** Reads the latest run preview for one generation node. */
  getGenerationPreview: (nodeId: string) => FlowGenerationPreview | undefined
  /** Resolves the current selected and available items for one input slot. */
  getInputState: (nodeId: string, slotId: string) => FlowInputState | null
  /** Reads one canvas node without subscribing to the graph collection. */
  getNode: (nodeId: string) => CanvasNode | undefined
  /** Server-owned Asset references used by port projections. */
  referenceData: FlowReferenceData
}

/** Translates a graph value type into its localized presentation label. */
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

/** Resolves a localized semantic label for one node handle. */
export function flowNodeHandleLabel(
  handle: FlowHandleDefinition,
  node: CanvasNode,
  t: TFunction,
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

/** Resolves the localized display name for one canvas node. */
export function flowNodeName(
  node: CanvasNode,
  t: TFunction,
  canvas: FlowNodePortCanvas,
) {
  if (node.type === 'asset' && node.assetId) {
    return canvas.referenceData.assetsById.get(node.assetId)?.name
      ?? t('flows.nodes.asset')
  }
  if (isGenerationNodeType(node.type)) {
    const model = getCanvasGenerationModel(node)
    return model ? t(model.labelKey) : t(`flows.nodes.${node.type}`)
  }
  return t(FLOW_NODE_METADATA[node.type].labelKey)
}
