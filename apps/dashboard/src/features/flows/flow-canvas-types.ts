import type { FlowGraphValidationContext, FlowNodeType } from '@talelabs/flows'
import type {
  FlowEdge,
  FlowNode,
  FlowReferenceAsset,
} from '@talelabs/sdk'
import type {
  Edge,
  Node,
} from '@xyflow/react'

export type CanvasNode = Node<Record<string, any>, FlowNodeType> & {
  assetId: null | string
  schemaVersion: number
  transient?: {
    kind: 'assetUpload'
  }
}
export type CanvasEdge = Edge<{ createdAt: string }>

export interface FlowCanvasAssetUpload {
  asset: FlowReferenceAsset
  previewUrl: string
  progress: number
  status: 'uploaded' | 'uploading'
}

export type FlowSaveStatus
  = | 'conflict'
    | 'error'
    | 'saved'
    | 'saving'
    | 'unsaved'

export interface FlowReferenceData extends FlowGraphValidationContext {
  assetsById: ReadonlyMap<string, FlowReferenceAsset>
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

export interface FlowGenerationPreviewDownload {
  content: string
  fileName: string
  mimeType: string
}

export type FlowGenerationPreviewOutput
  = | {
    assetId?: FlowReferenceAsset['id']
    download: FlowGenerationPreviewDownload
    kind: 'media'
    mediaType: 'audio' | 'image' | 'video'
    name: string
    valueType: 'AudioSet' | 'ImageSet' | 'VideoSet'
  }
  | {
    download: FlowGenerationPreviewDownload
    kind: 'text'
    name: string
    text: string
    valueType: 'Text'
  }

export interface FlowGenerationPreviewResultOutput {
  output: FlowGenerationPreviewOutput
  outputIndex: number
}

export interface FlowGenerationPreviewResultSet {
  itemKey: string
  jobId: string
  outputs: FlowGenerationPreviewResultOutput[]
}

export type FlowGenerationPreview
  = | {
    fingerprint: string
    output?: FlowGenerationPreviewOutput
    resultSets?: FlowGenerationPreviewResultSet[]
    retrySource?: never
    status: 'pending' | 'queued'
  }
  | {
    fingerprint: string
    output: FlowGenerationPreviewOutput
    resultSets?: FlowGenerationPreviewResultSet[]
    /** Whole-snapshot product retry source when this node completed only partially. */
    retrySource?: {
      runId: string
      status: 'canceled' | 'failed' | 'partial'
    }
    status: 'succeeded'
  }
  | {
    fingerprint: string
    /** The last successful result remains mounted when a later attempt fails. */
    output?: FlowGenerationPreviewOutput
    resultSets?: FlowGenerationPreviewResultSet[]
    /** Whole-snapshot product retry source; absent while the owning run is active. */
    retrySource?: {
      runId: string
      status: 'canceled' | 'failed' | 'partial'
    }
    status: 'error'
  }

export interface PersistedCanvasGraph {
  edges: FlowEdge[]
  nodes: FlowNode[]
}
