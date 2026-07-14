import type { z } from 'zod'

export type FlowNodeType
  = | 'asset'
    | 'audioGeneration'
    | 'imageGeneration'
    | 'llm'
    | 'musicGeneration'
    | 'soundEffectGeneration'
    | 'speechGeneration'
    | 'text'
    | 'videoGeneration'
    | 'voiceChanger'
    | 'voiceIsolation'

export type FlowAssetType = 'audio' | 'document' | 'image' | 'video'

export type FlowValueType
  = | 'Asset'
    | 'AudioSet'
    | 'ElementContext'
    | 'ImageSet'
    | 'Text'
    | 'VideoSet'

export type FlowHandleDirection = 'input' | 'output'

export interface FlowHandleDefinition {
  direction: FlowHandleDirection
  id: string
  maxConnections: null | number
  maxItems?: number
  minConnections: number
  valueTypes: readonly FlowValueType[]
}

export type FlowNodeReference = 'asset' | 'none'

export interface FlowImageCrop {
  height: number
  width: number
  x: number
  y: number
}

export type FlowNodeDataMigration = (data: unknown) => unknown

export interface FlowNodeTypeDefinition<
  Type extends FlowNodeType = FlowNodeType,
> {
  currentVersion: number
  id: Type
  migrations: Readonly<Partial<Record<number, FlowNodeDataMigration>>>
  reference: FlowNodeReference
  schemas: Readonly<Record<number, z.ZodType>>
  staticHandles: readonly FlowHandleDefinition[]
}

export interface FlowGraphNode {
  assetId: null | string
  data: Record<string, unknown>
  id: string
  positionX: number
  positionY: number
  schemaVersion: number
  type: string
}

export interface FlowGraphEdge {
  createdAt: string
  id: string
  sourceHandle: null | string
  sourceNodeId: string
  targetHandle: null | string
  targetNodeId: string
}

export interface FlowGraphValidationContext {
  assetTypesById: Readonly<Record<string, FlowAssetType>>
}

export interface FlowGraphIssue {
  code: string
  field: string
  params?: Record<string, boolean | number | string>
}

export interface FlowGraphValidationResult {
  issues: FlowGraphIssue[]
  nodes: FlowGraphNode[]
  valid: boolean
}

export interface ParsedFlowNodeData {
  data: Record<string, unknown>
  schemaVersion: number
  type: FlowNodeType
}

export type FlowInputSelection
  = | { mode: 'auto' }
    | { assetIds: string[], mode: 'manual' }

export interface GenerationNodeData {
  inputSelections: Record<string, FlowInputSelection>
  modelContractVersion: string
  modelId: string
  operationId: string
  settings: Record<string, boolean | number | string>
}

export type ImageGenerationNodeData = GenerationNodeData & { prompt: string }
export type LlmNodeData = GenerationNodeData & {
  instructions: string
  prompt: string
}
export type VideoGenerationNodeData = GenerationNodeData & { prompt: string }
export type SpeechGenerationNodeData = GenerationNodeData & { prompt: string }
export type MusicGenerationNodeData = GenerationNodeData & {
  lyrics: string
  prompt: string
}
export type SoundEffectGenerationNodeData = GenerationNodeData & {
  prompt: string
}
export type VoiceChangerNodeData = GenerationNodeData
export type VoiceIsolationNodeData = GenerationNodeData
