/**
 * Source-neutral immutable execution-plan contracts.
 *
 * DAG planning projects Flow graphs into this shape; direct Create requests
 * compile a single independent step into the same shape.
 */

import type { PromptTemplate } from '../../prompts/contracts.js'
import type {
  FlowRunPlan,
  PlannedRequestShard,
} from '../planning/planner-contracts.js'
import type { NormalizedFlowRunCommand } from '../planning/run-command.js'
import type {
  FlowItemReference,
  RuntimeDimensions,
} from '../values/runtime-values.js'

import { GENERATION_JOB_COMPILER_VERSION } from '../compilation/generation-job.js'
import { canonicalByteLength } from '../serialization/canonical-hash.js'
import { deepFreeze } from '../serialization/deep-freeze.js'
import { hashFlowRunPlan } from '../serialization/plan-hashes.js'

/** Current source-neutral execution-plan contract version. */
export const EXECUTION_PLAN_VERSION = 1 as const

/** One immutable runtime coordinate and its compiled provider requests. */
export interface ExecutionPlanWorkItem {
  /** Explicit runtime dimension coordinates for this item. */
  dimensions: RuntimeDimensions
  /** Expected canonical outputs across this item's request shards. */
  expectedOutputCount: number
  /** Stable item identity used by durable persistence and dependencies. */
  itemKey: string
  /** Immutable upstream lineage; empty for direct requests. */
  lineage: readonly FlowItemReference[]
  /** Compiled provider-neutral jobs executed for this item. */
  requestShards: readonly PlannedRequestShard[]
  /** Stable ordering within the execution step. */
  sortOrder: number
}

/** One executable generation step independent from its request source. */
export interface ExecutionPlanStep {
  catalogRevision: string
  catalogVersion: number
  /** Why the source-specific planner included this step. */
  inclusionReason: 'dependency' | 'descendant' | 'direct' | 'selected' | 'target'
  /** Zero-based dependency level used by durable orchestration. */
  level: number
  modelContractVersion: string
  modelId: string
  modelRevision: number
  operationId: string
  /** Provider-neutral output collection type. */
  outputValueType: string
  settings: Readonly<Record<string, boolean | number | string>>
  /** Stable source-neutral execution identity. */
  stepId: string
  /** Generation intent used for presentation and contract validation. */
  stepType: string
  workItems: readonly ExecutionPlanWorkItem[]
}

/** One dependency between executable steps. */
export interface ExecutionPlanDependency {
  sourceStepId: string
  targetStepId: string
}

/** Exact pre-existing Asset prerequisite captured by admission. */
export interface ExecutionPlanStaticAssetPrerequisite {
  assetId: string
  /** Step that consumes the locked Asset. */
  consumerStepId: string
  mediaType: string
}

/** Exact successful historical job output required by a Flow partial run. */
export interface ExecutionPlanPriorOutputPrerequisite {
  completedAt: string
  generationJobId: string
  itemKeys: readonly string[]
  outputId: string
  producerStepId: string
}

/** Bounded source-neutral immutable execution plan. */
export interface ExecutionPlan {
  /** Shared compiler used for every request shard in this plan. */
  compilerVersion: typeof GENERATION_JOB_COMPILER_VERSION
  /** Executable dependency edges only; direct plans contain none. */
  dependencies: readonly ExecutionPlanDependency[]
  /** Canonical plan hash independent from its Flow or Create source envelope. */
  executionPlanHash: string
  /** Dependency levels scheduled in order by the existing orchestrator. */
  levels: readonly (readonly string[])[]
  /** Current source-neutral plan contract version. */
  planVersion: typeof EXECUTION_PLAN_VERSION
  prerequisites: {
    priorOutputs: readonly ExecutionPlanPriorOutputPrerequisite[]
    staticAssets: readonly ExecutionPlanStaticAssetPrerequisite[]
  }
  steps: readonly ExecutionPlanStep[]
  summary: {
    expectedOutputCount: number
    planBytes: number
    plannedExecutableCount: number
    plannedItemCount: number
    plannedJobCount: number
    topologicalDepth: number
  }
}

/** Immutable Flow identity and graph evidence kept outside execution steps. */
export interface FlowRunSource {
  capturedEdges: FlowRunPlan['capturedEdges']
  capturedNodes: FlowRunPlan['capturedNodes']
  command: NormalizedFlowRunCommand
  flowId: string
  flowRevision: number
  /** Existing Flow planner hash used for optimistic admission parity. */
  flowPlanHash: string
  kind: 'flow'
  plannerVersion: FlowRunPlan['plannerVersion']
}

/** Bounded direct request retained for Create history and reuse. */
export interface CreateRunSourceRequest {
  audioIntent?: string
  /** Ordered canonical Asset inputs without URLs or presentation metadata. */
  inputs: readonly {
    assetId: string
    slotId: string
  }[]
  inline: Readonly<Record<string, string>>
  mediaMode: 'audio' | 'image' | 'video'
  modelContractVersion: string
  modelId: string
  operationId: string
  outputCount: number
  promptTemplates: Readonly<Record<string, PromptTemplate>>
  settings: Readonly<Record<string, boolean | number | string>>
}

/** Direct Create source with no Flow, graph, revision, or synthetic node data. */
export interface CreateRunSource {
  kind: 'create'
  request: CreateRunSourceRequest
}

/** Discriminator carried by every immutable run snapshot. */
export type RunSource = CreateRunSource | FlowRunSource

interface CreateExecutionPlanInput {
  dependencies: readonly ExecutionPlanDependency[]
  levels: readonly (readonly string[])[]
  prerequisites: ExecutionPlan['prerequisites']
  steps: readonly ExecutionPlanStep[]
}

/**
 * Canonically sizes, hashes, and freezes one source-neutral execution plan.
 */
export function createExecutionPlan(
  input: CreateExecutionPlanInput,
): ExecutionPlan {
  const summary = {
    expectedOutputCount: input.steps.reduce(
      (count, step) => count + step.workItems.reduce(
        (stepCount, item) => stepCount + item.expectedOutputCount,
        0,
      ),
      0,
    ),
    planBytes: 0,
    plannedExecutableCount: input.steps.length,
    plannedItemCount: input.steps.reduce(
      (count, step) => count + step.workItems.length,
      0,
    ),
    plannedJobCount: input.steps.reduce(
      (count, step) => count + step.workItems.reduce(
        (stepCount, item) => stepCount + item.requestShards.length,
        0,
      ),
      0,
    ),
    topologicalDepth: input.levels.length,
  }
  const planWithoutHash = {
    compilerVersion: GENERATION_JOB_COMPILER_VERSION,
    dependencies: [...input.dependencies],
    levels: input.levels.map(level => [...level]),
    planVersion: EXECUTION_PLAN_VERSION,
    prerequisites: input.prerequisites,
    steps: input.steps,
    summary,
  }
  let planBytes = 0
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const candidate = {
      ...planWithoutHash,
      summary: { ...summary, planBytes },
    }
    const next = canonicalByteLength(candidate)
    if (next === planBytes)
      break
    planBytes = next
  }
  const canonicalPlan = {
    ...planWithoutHash,
    summary: { ...summary, planBytes },
  }
  return deepFreeze({
    ...canonicalPlan,
    executionPlanHash: hashFlowRunPlan(canonicalPlan),
  })
}

/** Projects an ordinary Flow planner result into the generic execution plan. */
export function executionPlanFromFlowRunPlan(
  plan: FlowRunPlan & { planHash: string },
): ExecutionPlan {
  const executableIds = new Set(plan.executionNodes.map(node => node.nodeId))
  return createExecutionPlan({
    dependencies: plan.capturedEdges.flatMap(edge => (
      executableIds.has(edge.sourceNodeId)
      && executableIds.has(edge.targetNodeId)
        ? [{
            sourceStepId: edge.sourceNodeId,
            targetStepId: edge.targetNodeId,
          }]
        : []
    )),
    levels: plan.topologicalLevels.map(level => level.filter(
      nodeId => executableIds.has(nodeId),
    )).filter(level => level.length > 0),
    prerequisites: {
      priorOutputs: plan.prerequisites.priorOutputs.map(requirement => ({
        completedAt: requirement.completedAt,
        generationJobId: requirement.generationJobId,
        itemKeys: requirement.itemKeys,
        outputId: requirement.outputHandleId,
        producerStepId: requirement.nodeId,
      })),
      staticAssets: plan.prerequisites.staticAssets.map(requirement => ({
        assetId: requirement.assetId,
        consumerStepId: requirement.nodeId,
        mediaType: requirement.mediaType,
      })),
    },
    steps: plan.executionNodes.map(node => ({
      catalogRevision: node.catalogRevision,
      catalogVersion: node.catalogVersion,
      inclusionReason: node.inclusionReason,
      level: node.level,
      modelContractVersion: node.modelContractVersion,
      modelId: node.modelId,
      modelRevision: node.modelRevision,
      operationId: node.operationId,
      outputValueType: node.outputValueType,
      settings: node.settings,
      stepId: node.nodeId,
      stepType: node.nodeType,
      workItems: node.workItems.map(item => ({
        dimensions: item.dimensions,
        expectedOutputCount: item.expectedOutputCount,
        itemKey: item.itemKey,
        lineage: item.lineage,
        requestShards: item.requestShards,
        sortOrder: item.sortOrder,
      })),
    })),
  })
}

/** Projects Flow-specific immutable evidence outside the generic execution plan. */
export function flowRunSourceFromPlan(
  plan: FlowRunPlan & { planHash: string },
): FlowRunSource {
  return deepFreeze({
    capturedEdges: plan.capturedEdges,
    capturedNodes: plan.capturedNodes,
    command: plan.command,
    flowId: plan.flowId,
    flowPlanHash: plan.planHash,
    flowRevision: plan.flowRevision,
    kind: 'flow',
    plannerVersion: plan.plannerVersion,
  })
}
