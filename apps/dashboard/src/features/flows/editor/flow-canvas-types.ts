/** Editor composition contracts kept separate from persisted canvas state. */

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

/** React Flow node carrying the persisted TaleLabs node identity and optional upload state. */
export type CanvasNode = Node<Record<string, any>, FlowNodeType> & {
  /** Canonical Asset referenced directly by an Asset node, otherwise null. */
  assetId: null | string
  /** Persisted node-data schema version used for compatibility validation. */
  schemaVersion: number
  /** Marks client-only nodes that autosave must omit until upload registration succeeds. */
  transient?: {
    /** Current transient-node lifecycle; only Asset upload placeholders exist. */
    kind: 'assetUpload'
  }
}

/** React Flow edge retaining creation time for deterministic graph priority. */
export type CanvasEdge = Edge<{ createdAt: string }>

/** Ephemeral upload progress associated with a transient canvas Asset node. */
export interface FlowCanvasAssetUpload {
  /** Optimistic or canonical reference metadata displayed by the node. */
  asset: FlowReferenceAsset
  /** Object URL used only until canonical media becomes available. */
  previewUrl: string
  /** Overall hash/upload/register progress normalized from zero to one. */
  progress: number
  /** Whether registration has returned a canonical Asset. */
  status: 'uploaded' | 'uploading'
}

/** Autosave state rendered by the editor toolbar. */
export type FlowSaveStatus
  = | 'conflict'
    | 'error'
    | 'saved'
    | 'saving'
    | 'unsaved'

/** Immutable validation references plus a fast canonical Asset lookup for node UI. */
export interface FlowReferenceData extends FlowGraphValidationContext {
  /** Canonical Flow reference Assets keyed by id for node and inspector reads. */
  assetsById: ReadonlyMap<string, FlowReferenceAsset>
}

/** One upstream Asset candidate available to a generation input slot. */
export interface FlowCandidate {
  /** Canonical Asset id carried into planning and snapshots. */
  assetId: string
  /** Whether this candidate is the source node's primary output. */
  isPrimary: boolean
  /** Media family used to validate the target slot. */
  mediaType: FlowReferenceAsset['type']
  /** Canonical Asset name shown in candidate controls. */
  name: string
  /** Upstream canvas node id that exposes this candidate. */
  sourceId: string
  /** Display name of the upstream node. */
  sourceName: string
  /** Stable output ordering within the source node. */
  sortOrder: number
  /** Optional thumbnail used by input selection controls. */
  thumbnailUrl: null | string
}

/** Derived availability and manual-selection state for one generation input slot. */
export interface FlowInputState {
  /** Number of currently available candidates accepted by the slot. */
  availableCount: number
  /** Ordered candidates projected from connected upstream values. */
  candidates: FlowCandidate[]
  /** Number of edges currently connected to the slot handle. */
  connectionCount: number
  /** Whether selected candidates violate the active model contract. */
  invalid: boolean
  /** Maximum items accepted together by the active model slot. */
  maximum: number
  /** Whether execution consumes automatic or explicit candidate selection. */
  mode: 'auto' | 'manual'
  /** Canonical Asset ids explicitly selected in manual mode. */
  selectedAssetIds: string[]
  /** Number of selected ids that remain available and valid. */
  selectedAvailableCount: number
  /** Selected ids no longer exposed by connected upstream values. */
  unavailableAssetIds: string[]
}

/** Browser-download payload attached to a generated text or mock media output. */
export interface FlowGenerationPreviewDownload {
  /** Text or SVG content written into the browser Blob. */
  content: string
  /** Suggested filename including deterministic identity where required. */
  fileName: string
  /** MIME type supplied to the download Blob. */
  mimeType: string
}

/** Displayable media or text output projected from mock and durable run results. */
export type FlowGenerationPreviewOutput
  = | {
    /** Canonical Asset id after durable media ingestion, when available. */
    assetId?: FlowReferenceAsset['id']
    /** Fallback browser download for this output. */
    download: FlowGenerationPreviewDownload
    /** Media-output discriminator. */
    kind: 'media'
    /** Media renderer selected for the output. */
    mediaType: 'audio' | 'image' | 'video'
    /** Localized model or output name. */
    name: string
    /** Runtime value type emitted by the node. */
    valueType: 'AudioSet' | 'ImageSet' | 'VideoSet'
  }
  | {
    /** Browser download for generated text. */
    download: FlowGenerationPreviewDownload
    /** Text-output discriminator. */
    kind: 'text'
    /** Localized model or output name. */
    name: string
    /** Generated textual content displayed and copied by node actions. */
    text: string
    /** Runtime value type emitted by the node. */
    valueType: 'Text'
  }

/** One ordered output within a durable generation job's result set. */
export interface FlowGenerationPreviewResultOutput {
  /** Displayable output projected from the canonical job output. */
  output: FlowGenerationPreviewOutput
  /** Stable zero-based order when a job returns multiple outputs. */
  outputIndex: number
}

/** Outputs produced by one runtime item and its durable generation job. */
export interface FlowGenerationPreviewResultSet {
  /** Deterministic runtime item identity captured in the admitted run. */
  itemKey: string
  /** Durable generation-job id that produced these outputs. */
  jobId: string
  /** Canonical outputs in provider result order. */
  outputs: FlowGenerationPreviewResultOutput[]
}

/** Run lifecycle state and mounted output retained for one generation node. */
export type FlowGenerationPreview
  = | {
    /** Request fingerprint used to reject stale preview updates. */
    fingerprint: string
    /** Prior mounted output retained while a replacement is queued, when available. */
    output?: FlowGenerationPreviewOutput
    /** Durable per-item results accumulated so far. */
    resultSets?: FlowGenerationPreviewResultSet[]
    /** Active previews cannot expose a terminal retry source. */
    retrySource?: never
    /** Active admission/execution status. */
    status: 'pending' | 'queued'
  }
  | {
    /** Request fingerprint associated with the completed output. */
    fingerprint: string
    /** Primary output mounted on the node. */
    output: FlowGenerationPreviewOutput
    /** Durable per-item results, including multiple outputs. */
    resultSets?: FlowGenerationPreviewResultSet[]
    /** Whole-snapshot product retry source when this node completed only partially. */
    retrySource?: {
      runId: string
      status: 'canceled' | 'failed' | 'partial'
    }
    /** Completed preview lifecycle. */
    status: 'succeeded'
  }
  | {
    /** Request fingerprint associated with the failed attempt. */
    fingerprint: string
    /** The last successful result remains mounted when a later attempt fails. */
    output?: FlowGenerationPreviewOutput
    resultSets?: FlowGenerationPreviewResultSet[]
    /** Whole-snapshot product retry source; absent while the owning run is active. */
    retrySource?: {
      runId: string
      status: 'canceled' | 'failed' | 'partial'
    }
    /** Terminal preview lifecycle after failure or cancellation. */
    status: 'error'
  }

/** Persisted graph snapshot used as the autosave comparison baseline. */
export interface PersistedCanvasGraph {
  /** Persisted edges in deterministic graph priority order. */
  edges: FlowEdge[]
  /** Persisted nodes; transient upload placeholders are never included. */
  nodes: FlowNode[]
}
