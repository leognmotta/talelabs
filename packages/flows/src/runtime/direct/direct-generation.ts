/**
 * Direct-request projection into the shared immutable execution plan.
 *
 * This module contains no HTTP, persistence, credentials, provider routing, or
 * Flow graph behavior. Admission supplies validated current-catalog facts.
 */

import type {
  GenerationNodeType,
  GenerationSettingValue,
} from '../../generation/registry/types.js'
import type { PromptTemplate } from '../../prompts/contracts.js'
import type {
  CreateRunSource,
  ExecutionPlan,
} from '../execution-plan/contracts.js'

import { compileGenerationJob } from '../compilation/generation-job.js'
import { createExecutionPlan } from '../execution-plan/contracts.js'
import { deepFreeze } from '../serialization/deep-freeze.js'

/** Canonical locked Asset input accepted by direct compilation. */
export interface DirectGenerationAssetInput {
  /** Canonical tenant-owned Asset identity. */
  assetId: string
  /** Verified canonical media family. */
  mediaType: 'audio' | 'image' | 'video'
  /** Semantic current-model slot receiving this occurrence. */
  slotId: string
}

/** Fully validated current-catalog facts compiled for direct execution. */
export interface CompileDirectGenerationInput {
  /** Selected task-specific audio intent, when media mode is Audio. */
  audioIntent?: string
  /** Current catalog content hash. */
  catalogRevision: string
  /** Current monotonic catalog version. */
  catalogVersion: number
  /** Provider-neutral task-specific inline fields. */
  inline: Readonly<Record<string, string>>
  /** Current per-slot hard item limits. */
  inputLimits: Readonly<Record<string, number>>
  /** Ordered locked Asset occurrences. */
  inputs: readonly DirectGenerationAssetInput[]
  /** Direct media family selected by the user. */
  mediaMode: 'audio' | 'image' | 'video'
  /** Current public model contract version. */
  modelContractVersion: string
  /** Canonical creative model identity. */
  modelId: string
  /** Exact current model revision. */
  modelRevision: number
  /** Current resolved model operation. */
  operationId: string
  /** Provider-neutral output collection type. */
  outputValueType: string
  /** Exact expected output count. */
  outputCount: number
  /** Structured prompt fields retained without editor JSON. */
  promptTemplates: Readonly<Record<string, PromptTemplate>>
  /** Current normalized model setting values. */
  settings: Readonly<Record<string, GenerationSettingValue>>
  /** Generation intent retained for history and presentation. */
  stepType: Exclude<GenerationNodeType, 'audioGeneration'>
}

/** Result shared by direct estimate and admission paths. */
export interface CompiledDirectGeneration {
  /** Source-neutral plan consumed by the existing execution stack. */
  executionPlan: ExecutionPlan
  /** Bounded Create source retained in the immutable snapshot. */
  source: CreateRunSource
}

const DIRECT_GENERATION_STEP_ID = 'direct-generation'

function collectionKind(mediaType: DirectGenerationAssetInput['mediaType']) {
  if (mediaType === 'image')
    return 'imageSet' as const
  if (mediaType === 'video')
    return 'videoSet' as const
  return 'audioSet' as const
}

/** Compiles one validated direct request without constructing a Flow graph. */
export function compileDirectGeneration(
  input: CompileDirectGenerationInput,
): CompiledDirectGeneration {
  const requestInputs = input.inputs.map((asset, order) => ({
    bindingId: `direct-input:${order}`,
    items: [deepFreeze({
      dimensions: {},
      key: `direct-input:${order}`,
      lineage: [],
      value: {
        assets: [{
          assetId: asset.assetId,
          mediaType: asset.mediaType,
          source: 'staticAsset' as const,
        }],
        kind: collectionKind(asset.mediaType),
      },
    })],
    sourceId: asset.assetId,
    sourceOutputId: 'asset',
    targetSlotId: asset.slotId,
  }))
  const inputSelections = Object.fromEntries(
    [...new Set(input.inputs.map(asset => asset.slotId))].map(slotId => [
      slotId,
      input.inputs
        .filter(asset => asset.slotId === slotId)
        .map(asset => asset.assetId),
    ]),
  )
  const requestShard = compileGenerationJob({
    catalogRevision: input.catalogRevision,
    catalogVersion: input.catalogVersion,
    executionStepId: DIRECT_GENERATION_STEP_ID,
    inline: input.inline,
    inputLimits: input.inputLimits,
    inputSelections,
    inputs: requestInputs,
    itemKey: 'direct-request',
    modelContractVersion: input.modelContractVersion,
    modelId: input.modelId,
    modelRevision: input.modelRevision,
    operationId: input.operationId,
    outputCount: input.outputCount,
    promptTemplates: input.promptTemplates,
    requestIndex: 0,
    settings: input.settings,
  })
  const executionPlan = createExecutionPlan({
    dependencies: [],
    levels: [[DIRECT_GENERATION_STEP_ID]],
    prerequisites: {
      priorOutputs: [],
      staticAssets: [...new Map(input.inputs.map(asset => [
        asset.assetId,
        {
          assetId: asset.assetId,
          consumerStepId: DIRECT_GENERATION_STEP_ID,
          mediaType: asset.mediaType,
        },
      ])).values()],
    },
    steps: [{
      catalogRevision: input.catalogRevision,
      catalogVersion: input.catalogVersion,
      inclusionReason: 'direct',
      level: 0,
      modelContractVersion: input.modelContractVersion,
      modelId: input.modelId,
      modelRevision: input.modelRevision,
      operationId: input.operationId,
      outputValueType: input.outputValueType,
      settings: input.settings,
      stepId: DIRECT_GENERATION_STEP_ID,
      stepType: input.stepType,
      workItems: [{
        dimensions: {},
        expectedOutputCount: input.outputCount,
        itemKey: 'direct-request',
        lineage: [],
        requestShards: [requestShard],
        sortOrder: 0,
      }],
    }],
  })
  return deepFreeze({
    executionPlan,
    source: {
      kind: 'create',
      request: {
        ...(input.audioIntent ? { audioIntent: input.audioIntent } : {}),
        inline: input.inline,
        inputs: input.inputs.map(asset => ({
          assetId: asset.assetId,
          slotId: asset.slotId,
        })),
        mediaMode: input.mediaMode,
        modelContractVersion: input.modelContractVersion,
        modelId: input.modelId,
        operationId: input.operationId,
        outputCount: input.outputCount,
        promptTemplates: input.promptTemplates,
        settings: input.settings,
      },
    },
  })
}
