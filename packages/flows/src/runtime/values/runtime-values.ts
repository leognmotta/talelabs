import type { FlowAssetType } from '../../graph/types.js'

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
