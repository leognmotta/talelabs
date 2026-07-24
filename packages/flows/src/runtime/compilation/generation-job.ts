/**
 * Shared provider-neutral generation-job compilation.
 *
 * Flow planning and direct Create admission both call this boundary after
 * their own selection, validation, and input materialization responsibilities.
 */

import type { PromptTemplate } from '../../prompts/contracts.js'
import type {
  CompiledGenerationJobInput,
  PlannedJobRequestPayloadV6,
} from '../planning/planner-contracts.js'

import { deepFreeze } from '../serialization/deep-freeze.js'
import { hashFlowRunJob } from '../serialization/execution-hashes.js'

/** Current shared compiler identity captured in execution plans and jobs. */
export const GENERATION_JOB_COMPILER_VERSION = 'generation-job.1' as const

/** Complete canonical facts accepted by the shared generation-job compiler. */
export interface CompileGenerationJobInput {
  /** Catalog content hash used to resolve the creative contract. */
  catalogRevision: string
  /** Monotonic public catalog version used by the request. */
  catalogVersion: number
  /** Stable execution-step identity assigned by the source planner. */
  executionStepId: string
  /** Task-specific inline fields such as lyrics or instructions. */
  inline: Readonly<Record<string, string>>
  /** Per-slot model limits applied before provider translation. */
  inputLimits: Readonly<Record<string, number>>
  /** Explicit selected Asset identities for each semantic slot. */
  inputSelections: Readonly<Record<string, readonly string[]>>
  /** Ordered, materialized provider-neutral input bindings. */
  inputs: readonly CompiledGenerationJobInput[]
  /** Stable runtime coordinate for this request. */
  itemKey: string
  /** Current public model-contract version. */
  modelContractVersion: string
  /** Canonical creative model identity. */
  modelId: string
  /** Exact model record revision captured at compilation. */
  modelRevision: number
  /** Catalog operation selected after contract resolution. */
  operationId: string
  /** Expected sibling outputs from this provider request. */
  outputCount: number
  /** Structured prompts retained without editor-specific JSON. */
  promptTemplates: Readonly<Record<string, PromptTemplate>>
  /** Stable shard position within the runtime coordinate. */
  requestIndex: number
  /** Normalized provider-neutral model settings. */
  settings: Readonly<Record<string, boolean | number | string>>
}

/** Current compiled shard returned to both Flow and direct callers. */
export interface CompiledGenerationJob {
  /** Canonical hash used for idempotency, persistence, and provenance. */
  jobHash: string
  /** Immutable current request payload. */
  requestPayload: PlannedJobRequestPayloadV6
  /** Stable shard position within the runtime coordinate. */
  requestIndex: number
}

/**
 * Compiles and hashes one immutable provider-neutral generation request.
 *
 * The function does not inspect Flow graphs, Create drafts, credentials, or
 * provider bindings. Callers must supply already validated and materialized
 * facts from their source-specific planning boundary.
 */
export function compileGenerationJob(
  input: CompileGenerationJobInput,
): CompiledGenerationJob {
  const requestPayload: PlannedJobRequestPayloadV6 = deepFreeze({
    catalogRevision: input.catalogRevision,
    catalogVersion: input.catalogVersion,
    compilerVersion: GENERATION_JOB_COMPILER_VERSION,
    executionStepId: input.executionStepId,
    inline: { ...input.inline },
    inputLimits: { ...input.inputLimits },
    inputSelections: Object.fromEntries(
      Object.entries(input.inputSelections).map(([slotId, assetIds]) => [
        slotId,
        [...assetIds],
      ]),
    ),
    inputs: input.inputs.map(binding => ({
      bindingId: binding.bindingId,
      items: binding.items,
      sourceId: binding.sourceId,
      sourceOutputId: binding.sourceOutputId,
      targetSlotId: binding.targetSlotId,
    })),
    itemKey: input.itemKey,
    modelContractVersion: input.modelContractVersion,
    modelId: input.modelId,
    modelRevision: input.modelRevision,
    operationId: input.operationId,
    outputCount: input.outputCount,
    promptTemplates: { ...input.promptTemplates },
    requestIndex: input.requestIndex,
    requestPayloadVersion: 6,
    settings: { ...input.settings },
  })
  return Object.freeze({
    jobHash: hashFlowRunJob(requestPayload),
    requestIndex: input.requestIndex,
    requestPayload,
  })
}
