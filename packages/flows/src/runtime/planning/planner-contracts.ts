import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowGraphValidationContext,
  FlowNodeType,
} from '../../graph/types.js'
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

export interface PlannedStaticAssetPrerequisite {
  assetId: string
  mediaType: string
  nodeId: string
}

export interface PlannedPriorOutputRequirement {
  completedAt: string
  generationJobId: string
  itemKeys: readonly string[]
  nodeId: string
  outputHandleId: string
}

export interface PlannedRunInput {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

export interface PlannedJobRequestInput {
  edgeId: string
  items: readonly FlowItem<FlowRuntimeValue>[]
  sourceHandleId: string
  sourceNodeId: string
  targetHandleId: string
}

export interface PlannedJobRequestPayload {
  inline: Readonly<Record<string, string>>
  inputSelections: Readonly<Record<string, readonly string[]>>
  inputs: readonly PlannedJobRequestInput[]
  itemKey: string
  modelContractVersion: string
  modelId: string
  nodeId: string
  operationId: string
  outputCount: number
  requestIndex: number
  requestPayloadVersion: 1
  settings: Readonly<Record<string, boolean | number | string>>
}

export interface PlannedRequestShard {
  jobHash: string
  requestPayload: PlannedJobRequestPayload
  requestIndex: number
}

export interface PlannedNodeWorkItem {
  dimensions: RuntimeDimensions
  expectedOutputCount: number
  inputs: readonly PlannedRunInput[]
  itemKey: string
  lineage: readonly FlowItemReference[]
  requestShards: readonly PlannedRequestShard[]
  sortOrder: number
}

export interface PlannedExecutionNode {
  inclusionReason: FlowRunInclusionReason
  level: number
  modelContractVersion: string
  modelId: string
  nodeId: string
  nodeType: FlowNodeType
  operationId: string
  outputHandleId: string
  outputValueType: string
  settings: Readonly<Record<string, boolean | number | string>>
  workItems: readonly PlannedNodeWorkItem[]
}

export interface FlowRunPlanV1 {
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

export type FlowRunPlanningResult
  = | { issues: readonly FlowRunPlanningIssue[], ok: false }
    | { ok: true, plan: FlowRunPlanV1 & { planHash: string } }
