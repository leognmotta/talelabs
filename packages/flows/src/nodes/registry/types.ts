/** Node registry contracts: versioned data schemas, migrations, handles. */

import type {
  FlowHandleDefinition,
  FlowNodeType,
  FlowNodeTypeDefinition,
} from '../../graph/types.js'

import {
  getGenerationModelsForNodeType,
  isGenerationNodeType,
} from '../../generation/registry/index.js'
import {
  AssetNodeDataSchemaV3,
  AudioGenerationNodeDataSchemaV1,
  AudioGenerationNodeDataSchemaV2,
  ElementNodeDataSchema,
  EmptyNodeDataSchema,
  ImageGenerationNodeDataSchemaV1,
  ImageGenerationNodeDataSchemaV2,
  ImageGenerationNodeDataSchemaV3,
  ImageGenerationNodeDataSchemaV4,
  ImageGenerationNodeDataSchemaV5,
  ImageGenerationNodeDataSchemaV6,
  ImageGenerationNodeDataSchemaV7,
  LlmNodeDataSchemaV1,
  LockedNodeDataSchema,
  MusicGenerationNodeDataSchemaV1,
  SoundEffectGenerationNodeDataSchemaV1,
  SpeechGenerationNodeDataSchemaV1,
  TextNodeDataSchemaV1,
  TextNodeDataSchemaV2,
  VideoGenerationNodeDataSchemaV1,
  VideoGenerationNodeDataSchemaV2,
  VideoGenerationNodeDataSchemaV3,
  VoiceChangerNodeDataSchemaV1,
  VoiceIsolationNodeDataSchemaV1,
} from '../data/schemas.js'
import {
  migrateAssetNodeDataV1,
  migrateAssetNodeDataV2,
  migrateTextNodeDataV1,
} from '../migrations/asset-text.js'
import {
  migrateImageGenerationNodeDataV1,
  migrateImageGenerationNodeDataV3,
} from '../migrations/image-generation.js'
import {
  migrateImageGenerationNodeDataV2,
  migrateImageGenerationNodeDataV5,
  migrateImageGenerationNodeDataV6,
} from '../migrations/image.js'
import {
  addGenerationModelContractVersion,
} from '../migrations/index.js'
import { migrateVideoGenerationNodeDataV2 } from '../migrations/video.js'

const textHandles = Object.freeze([
  {
    direction: 'output',
    id: 'text',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['Text'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const llmOutputHandles = textHandles

const imageGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: 'images',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['ImageSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const videoGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: 'videos',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['VideoSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const audioGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: 'audio',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['AudioSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const elementOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: 'references',
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['ImageSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

/** Canonical registry: schema versions, migrations, and handles per type. */
export const FLOW_NODE_TYPE_REGISTRY = Object.freeze({
  asset: {
    currentVersion: 3,
    id: 'asset',
    migrations: {
      1: migrateAssetNodeDataV1,
      2: migrateAssetNodeDataV2,
    },
    reference: 'asset',
    schemas: {
      1: EmptyNodeDataSchema,
      2: LockedNodeDataSchema,
      3: AssetNodeDataSchemaV3,
    },
    staticHandles: [],
  },
  audioGeneration: {
    currentVersion: 2,
    id: 'audioGeneration',
    migrations: { 1: addGenerationModelContractVersion },
    reference: 'none',
    schemas: {
      1: AudioGenerationNodeDataSchemaV1,
      2: AudioGenerationNodeDataSchemaV2,
    },
    staticHandles: audioGenerationOutputHandles,
  },
  element: {
    currentVersion: 1,
    id: 'element',
    migrations: {},
    reference: 'none',
    schemas: { 1: ElementNodeDataSchema },
    staticHandles: elementOutputHandles,
  },
  imageGeneration: {
    currentVersion: 7,
    id: 'imageGeneration',
    migrations: {
      1: migrateImageGenerationNodeDataV1,
      2: migrateImageGenerationNodeDataV2,
      3: migrateImageGenerationNodeDataV3,
      4: addGenerationModelContractVersion,
      5: migrateImageGenerationNodeDataV5,
      6: migrateImageGenerationNodeDataV6,
    },
    reference: 'none',
    schemas: {
      1: ImageGenerationNodeDataSchemaV1,
      2: ImageGenerationNodeDataSchemaV2,
      3: ImageGenerationNodeDataSchemaV3,
      4: ImageGenerationNodeDataSchemaV4,
      5: ImageGenerationNodeDataSchemaV5,
      6: ImageGenerationNodeDataSchemaV6,
      7: ImageGenerationNodeDataSchemaV7,
    },
    staticHandles: imageGenerationOutputHandles,
  },
  llm: {
    currentVersion: 1,
    id: 'llm',
    migrations: {},
    reference: 'none',
    schemas: { 1: LlmNodeDataSchemaV1 },
    staticHandles: llmOutputHandles,
  },
  musicGeneration: {
    currentVersion: 1,
    id: 'musicGeneration',
    migrations: {},
    reference: 'none',
    schemas: { 1: MusicGenerationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  soundEffectGeneration: {
    currentVersion: 1,
    id: 'soundEffectGeneration',
    migrations: {},
    reference: 'none',
    schemas: { 1: SoundEffectGenerationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  speechGeneration: {
    currentVersion: 1,
    id: 'speechGeneration',
    migrations: {},
    reference: 'none',
    schemas: { 1: SpeechGenerationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  text: {
    currentVersion: 2,
    id: 'text',
    migrations: {
      1: migrateTextNodeDataV1,
    },
    reference: 'none',
    schemas: { 1: TextNodeDataSchemaV1, 2: TextNodeDataSchemaV2 },
    staticHandles: textHandles,
  },
  videoGeneration: {
    currentVersion: 3,
    id: 'videoGeneration',
    migrations: {
      1: addGenerationModelContractVersion,
      2: migrateVideoGenerationNodeDataV2,
    },
    reference: 'none',
    schemas: {
      1: VideoGenerationNodeDataSchemaV1,
      2: VideoGenerationNodeDataSchemaV2,
      3: VideoGenerationNodeDataSchemaV3,
    },
    staticHandles: videoGenerationOutputHandles,
  },
  voiceChanger: {
    currentVersion: 1,
    id: 'voiceChanger',
    migrations: {},
    reference: 'none',
    schemas: { 1: VoiceChangerNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
  voiceIsolation: {
    currentVersion: 1,
    id: 'voiceIsolation',
    migrations: {},
    reference: 'none',
    schemas: { 1: VoiceIsolationNodeDataSchemaV1 },
    staticHandles: audioGenerationOutputHandles,
  },
} as const satisfies Record<FlowNodeType, FlowNodeTypeDefinition>)

/** Stable wire vocabulary used to read and return historical Flow graphs. */
export const FLOW_NODE_TYPES = Object.freeze(
  Object.keys(FLOW_NODE_TYPE_REGISTRY) as FlowNodeType[],
)

/** Current node-creation vocabulary exposed by generation configuration. */
export const SELECTABLE_FLOW_NODE_TYPES = Object.freeze(
  (Object.keys(FLOW_NODE_TYPE_REGISTRY) as FlowNodeType[]).filter((type) => {
    if (!isGenerationNodeType(type))
      return true
    if (type === 'audioGeneration')
      return false
    return getGenerationModelsForNodeType(type).length > 0
  }),
)

/** Whether a value names a registered Flow node type. */
export function isFlowNodeType(value: unknown): value is FlowNodeType {
  return typeof value === 'string' && value in FLOW_NODE_TYPE_REGISTRY
}

/** Registry definition for one node type. */
export function getFlowNodeTypeDefinition(type: FlowNodeType) {
  return FLOW_NODE_TYPE_REGISTRY[type] as FlowNodeTypeDefinition
}
