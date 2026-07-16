/**
 * Flow-facing projection of the current checked-in model catalog.
 *
 * This module preserves the provider-neutral Flow contract while making
 * `@talelabs/models-catalog` the only maintained current model inventory.
 * Provider bindings remain private to admission and provider packages.
 *
 */

import type { PublicCatalogModel } from '@talelabs/models-catalog'
import type {
  GenerationModelDefinition,
  GenerationNodeType,
  GenerationOutputType,
  HardenedGenerationModelDefinition,
} from './types.js'

import {
  MODEL_CATALOG,
  SELECTABLE_CATALOG_MODELS,
} from '@talelabs/models-catalog'

/** Catalog format understood by mutable Flow drafts. */
export const GENERATION_MODEL_CONTRACT_VERSION
  = `catalog.${MODEL_CATALOG.catalogVersion}` as const

/** Catalog JSON format version captured in plans and snapshots. */
export const GENERATION_CATALOG_VERSION = MODEL_CATALOG.catalogVersion

/** Content-sensitive catalog identity used for compatibility and provenance. */
export const GENERATION_CATALOG_REVISION = MODEL_CATALOG.catalogRevision

/** Current Flow contract version accepted by graph readers. */
export type GenerationModelContractVersion
  = typeof GENERATION_MODEL_CONTRACT_VERSION

function toFlowModel(
  model: PublicCatalogModel,
): HardenedGenerationModelDefinition {
  const { status, ...definition } = model
  const flowModel = {
    ...definition,
    enabled: status === 'active',
  } satisfies HardenedGenerationModelDefinition
  return Object.freeze(flowModel)
}

/** Current provider-neutral model registry derived from the assembled catalog. */
export const GENERATION_MODEL_REGISTRY = Object.freeze(
  Object.fromEntries(
    SELECTABLE_CATALOG_MODELS.map(model => [model.id, toFlowModel(model)]),
  ),
) as Readonly<Record<string, HardenedGenerationModelDefinition>>

/** Current models in stable catalog source order. */
export const GENERATION_MODELS = Object.freeze(
  SELECTABLE_CATALOG_MODELS.map(model => GENERATION_MODEL_REGISTRY[model.id]!),
) as readonly GenerationModelDefinition[]

/** Current image models in stable catalog source order. */
export const IMAGE_GENERATION_MODELS = Object.freeze(
  GENERATION_MODELS.filter(model => model.mediaType === 'image'),
)

/** Canonical model identity accepted by current Flow drafts. */
export type GenerationModelId = string

/** Canonical image-model identity accepted by current Flow drafts. */
export type ImageGenerationModelId = string

/** Canonical default model IDs owned by the catalog. */
export const DEFAULT_GENERATION_MODEL_IDS = MODEL_CATALOG.defaults

const defaultGenerationModelIdsByNode: Partial<Record<
  Exclude<GenerationNodeType, 'audioGeneration'>,
  GenerationModelId
>> = {
  imageGeneration: DEFAULT_GENERATION_MODEL_IDS.image,
  llm: DEFAULT_GENERATION_MODEL_IDS.text,
  speechGeneration: DEFAULT_GENERATION_MODEL_IDS.audio,
  videoGeneration: DEFAULT_GENERATION_MODEL_IDS.video,
}

/** Default model IDs for node intents with a single product default. */
export const DEFAULT_GENERATION_MODEL_IDS_BY_NODE = Object.freeze(
  defaultGenerationModelIdsByNode,
)

/** Canonical default Image Generation model ID. */
export const DEFAULT_IMAGE_GENERATION_MODEL_ID
  = DEFAULT_GENERATION_MODEL_IDS.image

/** Output media family owned by each generation-node intent. */
export const GENERATION_NODE_MEDIA_TYPES = Object.freeze({
  audioGeneration: 'audio',
  imageGeneration: 'image',
  llm: 'text',
  musicGeneration: 'audio',
  soundEffectGeneration: 'audio',
  speechGeneration: 'audio',
  videoGeneration: 'video',
  voiceChanger: 'audio',
  voiceIsolation: 'audio',
} as const satisfies Record<GenerationNodeType, GenerationOutputType>)

/** Every generation-node intent understood by Flow validation. */
export const GENERATION_NODE_TYPES = Object.freeze(
  Object.keys(GENERATION_NODE_MEDIA_TYPES) as GenerationNodeType[],
)

/** Current model-adaptive generation node intents. */
export const ADAPTIVE_GENERATION_NODE_TYPES = Object.freeze([
  'imageGeneration',
  'llm',
  'musicGeneration',
  'soundEffectGeneration',
  'speechGeneration',
  'videoGeneration',
  'voiceChanger',
  'voiceIsolation',
] as const satisfies readonly GenerationNodeType[])
