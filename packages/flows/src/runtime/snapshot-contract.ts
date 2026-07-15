import type {
  FlowRunPlanV1,
  PlannedJobRequestPayload,
} from './planner.js'

import { z } from 'zod'

import {
  CANONICAL_SERIALIZER_VERSION,
  canonicalByteLength,
  hashFlowRunJob,
  hashFlowRunSnapshot,
} from './canonical-json.js'
import { FLOW_RUN_LIMITS } from './run-limits.js'

export const FLOW_RUN_PLAN_VERSION = 1 as const
export const FLOW_RUN_PLANNER_VERSION = 'm5.1.1' as const
export const FLOW_RUN_SNAPSHOT_VERSION = 1 as const

const PRESENTATION_ONLY_SNAPSHOT_KEYS = new Set([
  'dragging',
  'label',
  'position',
  'positionabsolute',
  'positionx',
  'positiony',
  'reactstate',
  'selected',
])

function isForbiddenSnapshotKey(key: string) {
  return key.includes('credential')
    || key.includes('apikey')
    || key.endsWith('url')
    || key.endsWith('storagekey')
    || key.endsWith('rawbytes')
    || PRESENTATION_ONLY_SNAPSHOT_KEYS.has(key)
}

export interface FlowRunSnapshotExecutionContract {
  adapterVersion: string
  modelContractVersion: string
  modelId: string
  modelRegistryVersion: string
  nodeId: string
  operationId: string
  /** Added after initial M5 snapshots; absent historical snapshots stay readable. */
  provider?: string
  providerModel: string
  providerRouteVersion: string
}

export interface FlowRunSnapshotV1<Plan extends object = object> {
  adapterContractVersion: string
  canonicalSerializerVersion: typeof CANONICAL_SERIALIZER_VERSION
  executionContracts: readonly FlowRunSnapshotExecutionContract[]
  executorVersion: string
  plan: Plan
  plannerVersion: typeof FLOW_RUN_PLANNER_VERSION
  snapshotVersion: typeof FLOW_RUN_SNAPSHOT_VERSION
}

export interface FlowRunSnapshotArtifact<Plan extends object> {
  bytes: number
  hash: string
  snapshot: FlowRunSnapshotV1<Plan>
}

export type ReadableFlowRunPlanSnapshot = FlowRunPlanV1 & { planHash: string }

export type FlowRunSnapshotReadErrorCode
  = | 'snapshot_executor_incompatible'
    | 'snapshot_hash_mismatch'
    | 'snapshot_invalid'
    | 'snapshot_version_unsupported'

export class FlowRunSnapshotReadError extends TypeError {
  readonly code: FlowRunSnapshotReadErrorCode

  constructor(code: FlowRunSnapshotReadErrorCode) {
    super(code)
    this.code = code
    this.name = 'FlowRunSnapshotReadError'
  }
}

function assertSafeSnapshotValue(
  value: unknown,
  path = '$',
  ancestors = new WeakSet<object>(),
) {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError(`snapshot_non_finite_number:${path}`)
    return
  }
  if (typeof value !== 'object')
    throw new TypeError(`snapshot_non_json_value:${path}`)
  if (ancestors.has(value))
    throw new TypeError(`snapshot_cycle:${path}`)
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        assertSafeSnapshotValue(entry, `${path}.${index}`, ancestors))
      return
    }
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError(`snapshot_non_json_value:${path}`)
    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = key.replaceAll(/[^a-z]/gi, '').toLowerCase()
      if (isForbiddenSnapshotKey(normalizedKey))
        throw new TypeError(`snapshot_forbidden_field:${path}.${key}`)
      assertSafeSnapshotValue(nested, `${path}.${key}`, ancestors)
    }
  }
  finally {
    ancestors.delete(value)
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== 'object' || seen.has(value))
    return value
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach(entry => deepFreeze(entry, seen))
  }
  else {
    Object.values(value).forEach(entry => deepFreeze(entry, seen))
  }
  return Object.freeze(value)
}

/** Builds and hashes an allowlisted, versioned snapshot envelope. */
export function createFlowRunSnapshotArtifact<Plan extends object>(
  snapshot: FlowRunSnapshotV1<Plan>,
): FlowRunSnapshotArtifact<Plan> {
  if (snapshot.snapshotVersion !== FLOW_RUN_SNAPSHOT_VERSION)
    throw new TypeError('unsupported_snapshot_version')
  if (snapshot.canonicalSerializerVersion !== CANONICAL_SERIALIZER_VERSION)
    throw new TypeError('unsupported_canonical_serializer_version')
  if (snapshot.plannerVersion !== FLOW_RUN_PLANNER_VERSION)
    throw new TypeError('unsupported_planner_version')
  assertSafeSnapshotValue(snapshot)
  const bytes = canonicalByteLength(snapshot)
  const hash = hashFlowRunSnapshot(snapshot)
  return Object.freeze({
    bytes,
    hash,
    snapshot: deepFreeze(snapshot),
  })
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const nonnegativeInteger = z.number().int().nonnegative()
const positiveInteger = z.number().int().positive()
const stringMap = z.record(z.string(), z.string())
const settingMap = z.record(
  z.string(),
  z.union([z.boolean(), z.number().finite(), z.string()]),
)
const lineageSchema = z.object({
  handleId: z.string(),
  itemKey: z.string(),
  nodeId: z.string(),
}).strict()
const staticAssetReferenceSchema = z.object({
  assetId: z.string(),
  mediaType: z.string(),
  source: z.literal('staticAsset'),
}).strict()
const priorOutputAssetReferenceSchema = z.object({
  assetId: z.string(),
  generationJobId: z.string(),
  mediaType: z.string(),
  outputIndex: nonnegativeInteger,
  source: z.literal('priorOutput'),
}).strict()
const sameRunOutputAssetReferenceSchema = z.object({
  itemKey: z.string(),
  mediaType: z.string(),
  nodeId: z.string(),
  outputIndex: nonnegativeInteger,
  source: z.literal('sameRunOutput'),
}).strict()
const runtimeAssetValueSchema = z.object({
  assets: z.array(z.union([
    staticAssetReferenceSchema,
    priorOutputAssetReferenceSchema,
    sameRunOutputAssetReferenceSchema,
  ])),
  kind: z.enum(['asset', 'audioSet', 'imageSet', 'videoSet']),
}).strict()
const runtimeTextValueSchema = z.object({
  kind: z.literal('text'),
  origin: z.union([
    z.object({ nodeId: z.string(), source: z.literal('staticText') }).strict(),
    z.object({
      generationJobId: z.string(),
      outputIndex: nonnegativeInteger,
      source: z.literal('priorOutput'),
    }).strict(),
    z.object({
      itemKey: z.string(),
      nodeId: z.string(),
      source: z.literal('sameRunOutput'),
    }).strict(),
  ]),
  text: z.string().nullable(),
}).strict()
const runtimeItemSchema = z.object({
  dimensions: stringMap,
  key: z.string(),
  lineage: z.array(lineageSchema),
  value: z.union([runtimeAssetValueSchema, runtimeTextValueSchema]),
}).strict()
const plannedInputSchema = z.object({
  edgeId: z.string(),
  items: z.array(runtimeItemSchema),
  sourceHandleId: z.string(),
  sourceNodeId: z.string(),
  targetHandleId: z.string(),
}).strict()
const requestPayloadSchema = z.object({
  inline: stringMap,
  inputSelections: z.record(z.string(), z.array(z.string())),
  inputs: z.array(plannedInputSchema),
  itemKey: z.string(),
  modelContractVersion: z.string(),
  modelId: z.string(),
  nodeId: z.string(),
  operationId: z.string(),
  provider: z.string().optional(),
  outputCount: positiveInteger,
  requestIndex: nonnegativeInteger,
  requestPayloadVersion: z.literal(1),
  settings: settingMap,
}).strict()

export type FlowRunJobRequestReadErrorCode
  = | 'job_request_hash_mismatch'
    | 'job_request_invalid'
    | 'job_request_too_large'

export class FlowRunJobRequestReadError extends TypeError {
  readonly code: FlowRunJobRequestReadErrorCode

  constructor(code: FlowRunJobRequestReadErrorCode) {
    super(code)
    this.code = code
    this.name = 'FlowRunJobRequestReadError'
  }
}

/**
 * Validates one persisted immutable provider-neutral request without loading
 * or reparsing the complete Flow snapshot in a generation child.
 */
export function readFlowRunJobRequestPayload(input: {
  requestHash: string
  requestPayload: unknown
}): PlannedJobRequestPayload {
  const parsed = requestPayloadSchema.safeParse(input.requestPayload)
  if (!parsed.success)
    throw new FlowRunJobRequestReadError('job_request_invalid')

  let bytes: number
  try {
    bytes = canonicalByteLength(parsed.data)
  }
  catch {
    throw new FlowRunJobRequestReadError('job_request_invalid')
  }
  if (bytes > FLOW_RUN_LIMITS.snapshotBytes)
    throw new FlowRunJobRequestReadError('job_request_too_large')
  if (hashFlowRunJob(parsed.data) !== input.requestHash)
    throw new FlowRunJobRequestReadError('job_request_hash_mismatch')

  return deepFreeze(parsed.data) as PlannedJobRequestPayload
}
const workItemSchema = z.object({
  dimensions: stringMap,
  expectedOutputCount: positiveInteger,
  inputs: z.array(plannedInputSchema),
  itemKey: z.string(),
  lineage: z.array(lineageSchema),
  requestShards: z.array(z.object({
    jobHash: z.string(),
    requestIndex: nonnegativeInteger,
    requestPayload: requestPayloadSchema,
  }).strict()),
  sortOrder: nonnegativeInteger,
}).strict()
const normalizedCommandSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all') }).strict(),
  z.object({
    mode: z.enum(['downstream', 'node', 'upstream']),
    targetNodeId: z.string(),
  }).strict(),
  z.object({
    mode: z.literal('selection'),
    selectedNodeIds: z.array(z.string()),
  }).strict(),
])
const readablePlanSchema = z.object({
  capturedEdges: z.array(z.object({
    id: z.string(),
    order: nonnegativeInteger,
    sourceHandle: z.string().nullable(),
    sourceNodeId: z.string(),
    targetHandle: z.string().nullable(),
    targetNodeId: z.string(),
  }).strict()),
  capturedNodes: z.array(z.object({
    assetId: z.string().nullable(),
    data: z.record(z.string(), z.unknown()),
    id: z.string(),
    schemaVersion: positiveInteger,
    type: z.string(),
  }).strict()),
  command: normalizedCommandSchema,
  executionNodes: z.array(z.object({
    inclusionReason: z.enum(['dependency', 'descendant', 'selected', 'target']),
    level: nonnegativeInteger,
    modelContractVersion: z.string(),
    modelId: z.string(),
    nodeId: z.string(),
    nodeType: z.string(),
    operationId: z.string(),
    outputHandleId: z.string(),
    outputValueType: z.string(),
    settings: settingMap,
    workItems: z.array(workItemSchema),
  }).strict()),
  flowId: z.string(),
  flowRevision: nonnegativeInteger,
  planHash: z.string(),
  plannerVersion: z.literal(FLOW_RUN_PLANNER_VERSION),
  planVersion: z.literal(FLOW_RUN_PLAN_VERSION),
  prerequisites: z.object({
    priorOutputs: z.array(z.object({
      completedAt: z.string(),
      generationJobId: z.string(),
      itemKeys: z.array(z.string()),
      nodeId: z.string(),
      outputHandleId: z.string(),
    }).strict()),
    staticAssets: z.array(z.object({
      assetId: z.string(),
      mediaType: z.string(),
      nodeId: z.string(),
    }).strict()),
  }).strict(),
  summary: z.object({
    expectedOutputCount: nonnegativeInteger,
    planBytes: nonnegativeInteger,
    plannedExecutableCount: nonnegativeInteger,
    plannedItemCount: nonnegativeInteger,
    plannedJobCount: nonnegativeInteger,
    requestedExecutableCount: nonnegativeInteger,
    topologicalDepth: nonnegativeInteger,
  }).strict(),
  topologicalLevels: z.array(z.array(z.string())),
}).strict()

const executionContractSchema = z.object({
  adapterVersion: z.string(),
  modelContractVersion: z.string(),
  modelId: z.string(),
  modelRegistryVersion: z.string(),
  nodeId: z.string(),
  operationId: z.string(),
  provider: z.string().optional(),
  providerModel: z.string(),
  providerRouteVersion: z.string(),
}).strict()

/** Reads one bounded execution-contract object selected from a run snapshot. */
export function readFlowRunSnapshotExecutionContract(
  value: unknown,
): FlowRunSnapshotExecutionContract {
  const parsed = executionContractSchema.safeParse(value)
  if (!parsed.success)
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  return deepFreeze(parsed.data)
}

/**
 * Reads a persisted snapshot through one integrity and compatibility boundary.
 * Callers may execute only the returned, validated artifact.
 */
export function readFlowRunSnapshotArtifact(input: {
  executorVersion: string
  expectedExecutorVersion: string
  graphSnapshot: unknown
  snapshotHash: string
  snapshotVersion: number
}): FlowRunSnapshotArtifact<ReadableFlowRunPlanSnapshot> {
  if (
    input.snapshotVersion !== FLOW_RUN_SNAPSHOT_VERSION
    || !isPlainRecord(input.graphSnapshot)
    || input.graphSnapshot.snapshotVersion !== FLOW_RUN_SNAPSHOT_VERSION
  ) {
    throw new FlowRunSnapshotReadError('snapshot_version_unsupported')
  }
  if (
    input.executorVersion !== input.expectedExecutorVersion
    || input.graphSnapshot.executorVersion !== input.executorVersion
  ) {
    throw new FlowRunSnapshotReadError('snapshot_executor_incompatible')
  }
  if (
    input.graphSnapshot.canonicalSerializerVersion
    !== CANONICAL_SERIALIZER_VERSION
    || input.graphSnapshot.plannerVersion !== FLOW_RUN_PLANNER_VERSION
    || typeof input.graphSnapshot.adapterContractVersion !== 'string'
    || !Array.isArray(input.graphSnapshot.executionContracts)
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }

  const executionContracts = z.array(executionContractSchema)
    .safeParse(input.graphSnapshot.executionContracts)
  const plan = readablePlanSchema.safeParse(input.graphSnapshot.plan)
  if (!executionContracts.success || !plan.success)
    throw new FlowRunSnapshotReadError('snapshot_invalid')

  let artifact: FlowRunSnapshotArtifact<object>
  try {
    artifact = createFlowRunSnapshotArtifact(
      input.graphSnapshot as unknown as FlowRunSnapshotV1<object>,
    )
  }
  catch {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
  if (artifact.hash !== input.snapshotHash)
    throw new FlowRunSnapshotReadError('snapshot_hash_mismatch')

  return artifact as FlowRunSnapshotArtifact<ReadableFlowRunPlanSnapshot>
}
