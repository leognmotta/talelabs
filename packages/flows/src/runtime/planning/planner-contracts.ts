/** Typed inputs, stage results, work items, and immutable output plan contracts. */

import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowNodeType,
} from '../../graph/types.js'
import type { PromptTemplate } from '../../prompts/contracts.js'
import type {
  FLOW_RUN_PLAN_VERSION,
  FLOW_RUN_PLANNER_VERSION,
} from '../snapshots/contracts.js'
import type {
  FlowItem,
  FlowItemReference,
  FlowRuntimeValue,
  PriorNodeOutputDescriptor,
  RuntimeDimensions,
} from '../values/runtime-values.js'
import type { FlowRunLimits } from './limits.js'
import type {
  FlowRunCommand,
  FlowRunInclusionReason,
  FlowRunPlanningIssue,
  NormalizedFlowRunCommand,
} from './run-command.js'

/** Result contract shared by the planner's typed intermediate stages. */
export type FlowRunPlanningStageResult<T>
  = | { issues: readonly FlowRunPlanningIssue[], ok: false }
    | { ok: true, value: T }

/** Mutable Flow revision, command, and locked prior outputs presented to planning. */
export interface FlowRunPlannerInput {
  command: FlowRunCommand
  context: FlowGraphValidationContext
  flow: {
    edges: readonly FlowGraphEdge[]
    id: string
    nodes: readonly FlowGraphNode[]
    revision: number
  }
  /** Internal verifier overrides; production callers use FLOW_RUN_LIMITS. */
  limits?: Partial<FlowRunLimits>
  priorOutputs?: readonly PriorNodeOutputDescriptor[]
}

/** Exact pre-existing Asset prerequisite captured by admission. */
export interface PlannedStaticAssetPrerequisite {
  assetId: string
  mediaType: string
  nodeId: string
}

/** Exact successful prior job output required by a partial run. */
export interface PlannedPriorOutputRequirement {
  completedAt: string
  generationJobId: string
  itemKeys: readonly string[]
  nodeId: string
  outputHandleId: string
}

/** One ordered runtime input bound to a target slot for a work item. */
export interface PlannedRunInput {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

/** Canonical request-payload projection of one planned runtime input. */
export interface PlannedJobRequestInput {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

/** Generic input binding compiled for current provider-neutral job requests. */
export interface CompiledGenerationJobInput {
  /** Stable identity of this input occurrence within the request. */
  bindingId: string
  /** Materialized runtime items carried by the binding. */
  items: readonly FlowItem<FlowRuntimeValue>[]
  /** Stable source identity; a Flow node ID or canonical Asset ID. */
  sourceId: string
  /** Source output identity when the request came from a Flow connection. */
  sourceOutputId: string
  /** Semantic model input slot receiving these items. */
  targetSlotId: string
}

interface LegacyPlannedJobRequestPayloadBase {
  catalogRevision: string
  catalogVersion: number
  inline: Readonly<Record<string, string>>
  inputSelections: Readonly<Record<string, readonly string[]>>
  inputs: readonly PlannedJobRequestInput[]
  itemKey: string
  modelContractVersion: string
  modelId: string
  modelRevision: number
  nodeId: string
  operationId: string
  outputCount: number
  requestIndex: number
  settings: Readonly<Record<string, boolean | number | string>>
}

interface PlannedJobRequestPayloadV3 extends LegacyPlannedJobRequestPayloadBase {
  /** Optional in legacy v3 payloads admitted before structured prompts. */
  inputLimits?: Readonly<Record<string, number>>
  /** Optional in legacy v3 payloads admitted before structured prompts. */
  promptTemplates?: Readonly<Record<string, PromptTemplate>>
  requestPayloadVersion: 3
}

interface StructuredPromptRequestPayload extends LegacyPlannedJobRequestPayloadBase {
  /** Maximum selected media inputs retained for each semantic slot. */
  inputLimits: Readonly<Record<string, number>>
  /** Structured inline prompt fields captured independently from editor JSON. */
  promptTemplates: Readonly<Record<string, PromptTemplate>>
}

interface PlannedJobRequestPayloadV4 extends StructuredPromptRequestPayload {
  requestPayloadVersion: 4
}

interface PlannedJobRequestPayloadV5 extends StructuredPromptRequestPayload {
  /** Preserves each selected connector occurrence, including repeated Assets. */
  requestPayloadVersion: 5
}

/** Current generic request payload emitted by the shared job compiler. */
export interface PlannedJobRequestPayloadV6 {
  catalogRevision: string
  catalogVersion: number
  /** Code-owned compiler identity captured with the immutable request. */
  compilerVersion: string
  /** Stable execution-step identity without implying a persisted Flow node. */
  executionStepId: string
  inline: Readonly<Record<string, string>>
  /** Maximum selected media inputs retained for each semantic slot. */
  inputLimits: Readonly<Record<string, number>>
  inputSelections: Readonly<Record<string, readonly string[]>>
  inputs: readonly CompiledGenerationJobInput[]
  itemKey: string
  modelContractVersion: string
  modelId: string
  modelRevision: number
  operationId: string
  outputCount: number
  /** Structured inline prompt fields captured independently from editor JSON. */
  promptTemplates: Readonly<Record<string, PromptTemplate>>
  requestIndex: number
  requestPayloadVersion: 6
  settings: Readonly<Record<string, boolean | number | string>>
}

/** Immutable provider-neutral job identity with explicit legacy compatibility. */
export type PlannedJobRequestPayload
  = | PlannedJobRequestPayloadV3
    | PlannedJobRequestPayloadV4
    | PlannedJobRequestPayloadV5
    | PlannedJobRequestPayloadV6

/** One deterministically hashed provider request belonging to a work item. */
export interface PlannedRequestShard {
  jobHash: string
  requestPayload: PlannedJobRequestPayload
  requestIndex: number
}

/** One runtime coordinate and its provider request shards. */
export interface PlannedNodeWorkItem {
  dimensions: RuntimeDimensions
  expectedOutputCount: number
  inputs: readonly PlannedRunInput[]
  itemKey: string
  lineage: readonly FlowItemReference[]
  requestShards: readonly PlannedRequestShard[]
  sortOrder: number
}

/** One selected executable node with topological position and expanded work. */
export interface PlannedExecutionNode {
  catalogRevision: string
  catalogVersion: number
  inclusionReason: FlowRunInclusionReason
  level: number
  modelContractVersion: string
  modelId: string
  modelRevision: number
  nodeId: string
  nodeType: FlowNodeType
  operationId: string
  outputHandleId: string
  outputValueType: string
  settings: Readonly<Record<string, boolean | number | string>>
  workItems: readonly PlannedNodeWorkItem[]
}

/** Complete bounded immutable execution plan captured in a run snapshot. */
export interface FlowRunPlan {
  capturedEdges: readonly {
    id: string
    order: number
    sourceHandle: null | string
    sourceNodeId: string
    targetHandle: null | string
    targetNodeId: string
  }[]
  capturedNodes: readonly {
    assetId: null | string
    data: Readonly<Record<string, unknown>>
    id: string
    schemaVersion: number
    type: string
  }[]
  command: NormalizedFlowRunCommand
  executionNodes: readonly PlannedExecutionNode[]
  flowId: string
  flowRevision: number
  planVersion: typeof FLOW_RUN_PLAN_VERSION
  plannerVersion: typeof FLOW_RUN_PLANNER_VERSION
  prerequisites: {
    priorOutputs: readonly PlannedPriorOutputRequirement[]
    staticAssets: readonly PlannedStaticAssetPrerequisite[]
  }
  summary: {
    expectedOutputCount: number
    planBytes: number
    plannedExecutableCount: number
    plannedItemCount: number
    plannedJobCount: number
    requestedExecutableCount: number
    topologicalDepth: number
  }
  topologicalLevels: readonly (readonly string[])[]
}

/** Success or stable issue result returned by the public planner. */
export type FlowRunPlanningResult
  = | { issues: readonly FlowRunPlanningIssue[], ok: false }
    | { ok: true, plan: FlowRunPlan & { planHash: string } }
