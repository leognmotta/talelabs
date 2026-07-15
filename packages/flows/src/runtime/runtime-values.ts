import type { FlowAssetType } from '../types.js'

import { compareStableStrings } from '../stable-order.js'
import { hashFlowRunItem } from './canonical-json.js'

export type ActiveRuntimeValueType
  = | 'Asset'
    | 'AudioSet'
    | 'ImageSet'
    | 'Text'
    | 'VideoSet'

export type RuntimeDimensions = Readonly<Record<string, string>>

export interface FlowItemReference {
  handleId: string
  itemKey: string
  nodeId: string
}

/**
 * Outer Flow items represent explicit execution multiplicity. A value inside
 * one item may still be a multi-Asset collection consumed by a single job.
 */
export interface FlowItem<T> {
  dimensions: RuntimeDimensions
  key: string
  lineage: readonly FlowItemReference[]
  value: T
}

export type PortValue<T> = readonly FlowItem<T>[]

export interface StaticAssetReference {
  assetId: string
  mediaType: FlowAssetType
  source: 'staticAsset'
}

export interface PriorOutputAssetReference {
  assetId: string
  generationJobId: string
  mediaType: Exclude<FlowAssetType, 'document'>
  outputIndex: number
  source: 'priorOutput'
}

/**
 * Same-run references deliberately have no Asset ID at admission. The durable
 * executor later binds this frozen producer coordinate to the created Asset.
 */
export interface SameRunOutputAssetReference {
  itemKey: string
  mediaType: Exclude<FlowAssetType, 'document'>
  nodeId: string
  outputIndex: number
  source: 'sameRunOutput'
}

export type RuntimeAssetReference
  = | PriorOutputAssetReference
    | SameRunOutputAssetReference
    | StaticAssetReference

export interface RuntimeTextValue {
  kind: 'text'
  origin:
    | { nodeId: string, source: 'staticText' }
    | {
      generationJobId: string
      outputIndex: number
      source: 'priorOutput'
    }
    | { itemKey: string, nodeId: string, source: 'sameRunOutput' }
  /** Null only for a same-run text result that does not exist at admission. */
  text: null | string
}

export type RuntimeAssetCollectionValue
  = | { assets: readonly RuntimeAssetReference[], kind: 'asset' }
    | { assets: readonly RuntimeAssetReference[], kind: 'audioSet' }
    | { assets: readonly RuntimeAssetReference[], kind: 'imageSet' }
    | { assets: readonly RuntimeAssetReference[], kind: 'videoSet' }

export type FlowRuntimeValue = RuntimeAssetCollectionValue | RuntimeTextValue

export interface PriorNodeOutputDescriptor {
  completedAt: string
  generationJobId: string
  items: PortValue<FlowRuntimeValue>
  nodeId: string
  outputHandleId: string
  pinned?: boolean
}

export function normalizeRuntimeDimensions(
  dimensions: RuntimeDimensions,
): RuntimeDimensions {
  return Object.freeze(Object.fromEntries(
    Object.entries(dimensions).toSorted(([left], [right]) =>
      compareStableStrings(left, right)),
  ))
}

export function deriveRuntimeItemKey(input: {
  dimensions: RuntimeDimensions
  lineage: readonly FlowItemReference[]
  nodeId: string
}) {
  return `item_${hashFlowRunItem({
    dimensions: normalizeRuntimeDimensions(input.dimensions),
    lineage: input.lineage,
    nodeId: input.nodeId,
  })}`
}

export function createRuntimeItem<T>(input: {
  dimensions?: RuntimeDimensions
  key?: string
  lineage?: readonly FlowItemReference[]
  nodeId: string
  value: T
}): FlowItem<T> {
  const dimensions = normalizeRuntimeDimensions(input.dimensions ?? {})
  const lineage = Object.freeze([...(input.lineage ?? [])])
  return Object.freeze({
    dimensions,
    key: input.key ?? deriveRuntimeItemKey({
      dimensions,
      lineage,
      nodeId: input.nodeId,
    }),
    lineage,
    value: input.value,
  })
}

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

export function createStaticTextItem(input: { nodeId: string, text: string }) {
  return createRuntimeItem<RuntimeTextValue>({
    key: `text_${hashFlowRunItem({ nodeId: input.nodeId, text: input.text })}`,
    nodeId: input.nodeId,
    value: {
      kind: 'text',
      origin: { nodeId: input.nodeId, source: 'staticText' },
      text: input.text,
    },
  })
}
