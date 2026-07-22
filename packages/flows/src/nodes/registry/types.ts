/** Node registry contracts: versioned data schemas, migrations, handles. */

import type { GenerationOutputType } from '../../generation/registry/types.js'
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
  ImageGenerationNodeDataSchemaV8,
  LlmNodeDataSchemaV1,
  LlmNodeDataSchemaV2,
  LockedNodeDataSchema,
  MusicGenerationNodeDataSchemaV1,
  MusicGenerationNodeDataSchemaV2,
  SoundEffectGenerationNodeDataSchemaV1,
  SoundEffectGenerationNodeDataSchemaV2,
  SpeechGenerationNodeDataSchemaV1,
  SpeechGenerationNodeDataSchemaV2,
  TextNodeDataSchemaV1,
  TextNodeDataSchemaV2,
  VideoGenerationNodeDataSchemaV1,
  VideoGenerationNodeDataSchemaV2,
  VideoGenerationNodeDataSchemaV3,
  VideoGenerationNodeDataSchemaV4,
  VoiceChangerNodeDataSchemaV1,
  VoiceIsolationNodeDataSchemaV1,
  VoiceIsolationNodeDataSchemaV2,
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
import {
  migrateImageGenerationNodeDataV7,
  migrateLlmNodeDataV1,
  migrateMusicGenerationNodeDataV1,
  migrateSoundEffectGenerationNodeDataV1,
  migrateSpeechGenerationNodeDataV1,
  migrateVideoGenerationNodeDataV3,
} from '../migrations/prompts.js'
import { migrateVideoGenerationNodeDataV2 } from '../migrations/video.js'
import { migrateVoiceIsolationNodeDataV1 } from '../migrations/voice-isolation.js'

/** Canonical output-handle identity for each generated value family. */
export const GENERATION_OUTPUT_HANDLE_IDS = Object.freeze({
  audio: 'audio',
  image: 'images',
  text: 'text',
  video: 'videos',
} as const satisfies Record<GenerationOutputType, string>)

/** Resolves the registered output handle used by generated prior results. */
export function getGenerationOutputHandleId(
  outputType: GenerationOutputType,
) {
  return GENERATION_OUTPUT_HANDLE_IDS[outputType]
}

const textHandles = Object.freeze([
  {
    direction: 'output',
    id: GENERATION_OUTPUT_HANDLE_IDS.text,
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['Text'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const llmOutputHandles = textHandles

const imageGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: GENERATION_OUTPUT_HANDLE_IDS.image,
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['ImageSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const videoGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: GENERATION_OUTPUT_HANDLE_IDS.video,
    maxConnections: null,
    minConnections: 0,
    valueTypes: ['VideoSet'],
  },
] as const satisfies readonly FlowHandleDefinition[])

const audioGenerationOutputHandles = Object.freeze([
  {
    direction: 'output',
    id: GENERATION_OUTPUT_HANDLE_IDS.audio,
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
    currentVersion: 8,
    id: 'imageGeneration',
    migrations: {
      1: migrateImageGenerationNodeDataV1,
      2: migrateImageGenerationNodeDataV2,
      3: migrateImageGenerationNodeDataV3,
      4: addGenerationModelContractVersion,
      5: migrateImageGenerationNodeDataV5,
      6: migrateImageGenerationNodeDataV6,
      7: migrateImageGenerationNodeDataV7,
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
      8: ImageGenerationNodeDataSchemaV8,
    },
    staticHandles: imageGenerationOutputHandles,
  },
  llm: {
    currentVersion: 2,
    id: 'llm',
    migrations: { 1: migrateLlmNodeDataV1 },
    reference: 'none',
    schemas: { 1: LlmNodeDataSchemaV1, 2: LlmNodeDataSchemaV2 },
    staticHandles: llmOutputHandles,
  },
  musicGeneration: {
    currentVersion: 2,
    id: 'musicGeneration',
    migrations: { 1: migrateMusicGenerationNodeDataV1 },
    reference: 'none',
    schemas: {
      1: MusicGenerationNodeDataSchemaV1,
      2: MusicGenerationNodeDataSchemaV2,
    },
    staticHandles: audioGenerationOutputHandles,
  },
  soundEffectGeneration: {
    currentVersion: 2,
    id: 'soundEffectGeneration',
    migrations: { 1: migrateSoundEffectGenerationNodeDataV1 },
    reference: 'none',
    schemas: {
      1: SoundEffectGenerationNodeDataSchemaV1,
      2: SoundEffectGenerationNodeDataSchemaV2,
    },
    staticHandles: audioGenerationOutputHandles,
  },
  speechGeneration: {
    currentVersion: 2,
    id: 'speechGeneration',
    migrations: { 1: migrateSpeechGenerationNodeDataV1 },
    reference: 'none',
    schemas: {
      1: SpeechGenerationNodeDataSchemaV1,
      2: SpeechGenerationNodeDataSchemaV2,
    },
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
    currentVersion: 4,
    id: 'videoGeneration',
    migrations: {
      1: addGenerationModelContractVersion,
      2: migrateVideoGenerationNodeDataV2,
      3: migrateVideoGenerationNodeDataV3,
    },
    reference: 'none',
    schemas: {
      1: VideoGenerationNodeDataSchemaV1,
      2: VideoGenerationNodeDataSchemaV2,
      3: VideoGenerationNodeDataSchemaV3,
      4: VideoGenerationNodeDataSchemaV4,
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
    currentVersion: 2,
    id: 'voiceIsolation',
    migrations: { 1: migrateVoiceIsolationNodeDataV1 },
    reference: 'none',
    schemas: {
      1: VoiceIsolationNodeDataSchemaV1,
      2: VoiceIsolationNodeDataSchemaV2,
    },
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
