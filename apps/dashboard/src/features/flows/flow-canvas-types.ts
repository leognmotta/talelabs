import type { FlowGraphValidationContext, FlowNodeType } from '@talelabs/flows'
import type {
  FlowEdge,
  FlowElementAssetReference,
  FlowNode,
  FlowReferenceAsset,
  FlowReferenceElement,
} from '@talelabs/sdk'
import type {
  Edge,
  Node,
} from '@xyflow/react'

export type CanvasNode = Node<Record<string, any>, FlowNodeType> & {
  assetId: null | string
  elementId: null | string
  schemaVersion: number
}
export type CanvasEdge = Edge<{ createdAt: string }>

export type FlowSaveStatus
  = | 'conflict'
    | 'error'
    | 'saved'
    | 'saving'
    | 'unsaved'

export interface FlowReferenceData extends FlowGraphValidationContext {
  assetsById: ReadonlyMap<string, FlowReferenceAsset>
  elementKitsById: ReadonlyMap<string, FlowElementAssetLink[]>
  elementsById: ReadonlyMap<string, FlowReferenceElement>
}

export type FlowElementAssetLink = FlowElementAssetReference & {
  asset: FlowReferenceAsset
}

export interface FlowCandidate {
  assetId: string
  isPrimary: boolean
  mediaType: FlowReferenceAsset['type']
  name: string
  sourceId: string
  sourceName: string
  sortOrder: number
  thumbnailUrl: null | string
}

export interface FlowInputState {
  availableCount: number
  candidates: FlowCandidate[]
  connectionCount: number
  invalid: boolean
  maximum: number
  mode: 'auto' | 'manual'
  selectedAssetIds: string[]
  selectedAvailableCount: number
  unavailableAssetIds: string[]
}

export interface PersistedCanvasGraph {
  edges: FlowEdge[]
  nodes: FlowNode[]
}
