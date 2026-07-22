/** Core Flow graph value types: node types, handles, and graph shapes. */

import type { z } from 'zod'
import type { PromptTemplate } from '../prompts/contracts.js'

/** Every registered Flow node type in the graph vocabulary. */
export type FlowNodeType
  = | 'asset'
    | 'audioGeneration'
    | 'element'
    | 'imageGeneration'
    | 'llm'
    | 'musicGeneration'
    | 'soundEffectGeneration'
    | 'speechGeneration'
    | 'text'
    | 'videoGeneration'
    | 'voiceChanger'
    | 'voiceIsolation'

/** Media family an Asset-bearing node resolves to. */
export type FlowAssetType = 'audio' | 'document' | 'image' | 'video'

/** Typed value a handle carries; a `*Set` is a collection consumed together. */
export type FlowValueType
  = | 'Asset'
    | 'AudioSet'
    | 'ImageSet'
    | 'Text'
    | 'VideoSet'

/** Whether a handle is an input or an output. */
export type FlowHandleDirection = 'input' | 'output'

/** One typed input or output handle on a node type. */
export interface FlowHandleDefinition {
  /** Input or output. */
  direction: FlowHandleDirection
  /** Stable handle id, unique within its node. */
  id: string
  /** Maximum edges on this handle, or null for unbounded. */
  maxConnections: null | number
  /** Maximum items the connected value may carry, when bounded. */
  maxItems?: number
  /** Minimum edges required for a complete executable node. */
  minConnections: number
  /** Value types this handle accepts or emits. */
  valueTypes: readonly FlowValueType[]
}

/** Whether a node stores a relational Asset FK (`asset`) or none. */
export type FlowNodeReference = 'asset' | 'none'

/** Normalized image crop rectangle in 0–1 fractions of the source. */
export interface FlowImageCrop {
  /** Crop height as a fraction of source height. */
  height: number
  /** Crop width as a fraction of source width. */
  width: number
  /** Left offset as a fraction of source width. */
  x: number
  /** Top offset as a fraction of source height. */
  y: number
}

/** Upcasts one prior-version node `data` payload to the next version. */
export type FlowNodeDataMigration = (data: unknown) => unknown

/** Registry contract for one node type: versioned schemas, migrations, handles. */
export interface FlowNodeTypeDefinition<
  Type extends FlowNodeType = FlowNodeType,
> {
  /** Latest persisted data schema version. */
  currentVersion: number
  /** The node type this definition describes. */
  id: Type
  /** Deterministic upcasters keyed by the source version. */
  migrations: Readonly<Partial<Record<number, FlowNodeDataMigration>>>
  /** Whether the node carries a relational Asset FK. */
  reference: FlowNodeReference
  /** Zod data schema per version. */
  schemas: Readonly<Record<number, z.ZodType>>
  /** Fixed handles the node always exposes. */
  staticHandles: readonly FlowHandleDefinition[]
}

/** One persisted graph node in wire form. */
export interface FlowGraphNode {
  /** Relational Asset FK for Asset nodes, else null. */
  assetId: null | string
  /** Parsed, version-current node data payload. */
  data: Record<string, unknown>
  /** Node id, unique within the Flow. */
  id: string
  /** Canvas x position. */
  positionX: number
  /** Canvas y position. */
  positionY: number
  /** Persisted data schema version. */
  schemaVersion: number
  /** Node type string (validated against the registry). */
  type: string
}

/** One persisted graph edge in wire form. */
export interface FlowGraphEdge {
  /** Creation timestamp; ascending id defines canonical edge order. */
  createdAt: string
  /** Edge id, unique within the Flow. */
  id: string
  /** Source node's output handle, or null for the default. */
  sourceHandle: null | string
  /** Source node id. */
  sourceNodeId: string
  /** Target node's input handle, or null for the default. */
  targetHandle: null | string
  /** Target node id. */
  targetNodeId: string
}

/** Resolved reference data a graph is validated against. */
export interface FlowGraphValidationContext {
  /** Media type for every Asset node's Asset. */
  assetTypesById: Readonly<Record<string, FlowAssetType>>
  /**
   * Ordered reference Asset IDs for every Element reachable from the graph.
   * Every listed Asset ID must also be resolvable through `assetTypesById`.
   */
  elementReferencesById: Readonly<Record<string, readonly string[]>>
}

/** One validation issue with a stable machine code and field path. */
export interface FlowGraphIssue {
  /** Stable machine-readable issue code. */
  code: string
  /** Dotted field path the issue anchors to. */
  field: string
  /** Optional structured parameters for client rendering. */
  params?: Record<string, boolean | number | string>
}

/** Outcome of validating a graph draft. */
export interface FlowGraphValidationResult {
  /** All collected issues; run-blocking and advisory. */
  issues: FlowGraphIssue[]
  /** The normalized nodes that passed schema parsing. */
  nodes: FlowGraphNode[]
  /** Whether the draft is valid for persistence. */
  valid: boolean
}

/** A node's data parsed and upcast to its current schema version. */
export interface ParsedFlowNodeData {
  /** Version-current data payload. */
  data: Record<string, unknown>
  /** The current schema version applied. */
  schemaVersion: number
  /** The validated node type. */
  type: FlowNodeType
}

/** How a consuming slot selects items from its candidate inputs. */
export type FlowInputSelection
  = | { mode: 'auto' }
    | { assetIds: string[], mode: 'manual' }

/** Shared data payload for every generation node. */
export interface GenerationNodeData {
  /** Per-input-slot selection strategy. */
  inputSelections: Record<string, FlowInputSelection>
  /** Pinned model capability contract version. */
  modelContractVersion: string
  /** Canonical `vendor/model` creative id. */
  modelId: string
  /** Selected model operation id. */
  operationId: string
  /** Validated per-model settings. */
  settings: Record<string, boolean | number | string>
}

/** Image generation node data. */
export type ImageGenerationNodeData = GenerationNodeData & {
  /** Structured inline prompt resolved before provider execution. */
  prompt: PromptTemplate
}
/** LLM node data: instructions plus prompt. */
export type LlmNodeData = GenerationNodeData & {
  /** Plain system instructions kept separate from the user prompt. */
  instructions: string
  /** Structured inline prompt resolved before provider execution. */
  prompt: PromptTemplate
}
/** Video generation node data. */
export type VideoGenerationNodeData = GenerationNodeData & {
  /** Structured inline prompt resolved before provider execution. */
  prompt: PromptTemplate
}
/** Speech generation node data. */
export type SpeechGenerationNodeData = GenerationNodeData & {
  /** Structured inline script resolved before provider execution. */
  prompt: PromptTemplate
}
/** Music generation node data: lyrics plus prompt. */
export type MusicGenerationNodeData = GenerationNodeData & {
  /** Plain lyrics retained outside the structured prompt editor. */
  lyrics: string
  /** Structured creative direction resolved before provider execution. */
  prompt: PromptTemplate
}
/** Sound-effect generation node data. */
export type SoundEffectGenerationNodeData = GenerationNodeData & {
  /** Structured sound description resolved before provider execution. */
  prompt: PromptTemplate
}
/** Voice-changer node data. */
export type VoiceChangerNodeData = GenerationNodeData
/** Voice-isolation node data. */
export type VoiceIsolationNodeData = GenerationNodeData
