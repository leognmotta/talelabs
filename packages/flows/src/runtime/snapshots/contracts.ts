/** Versioned immutable Flow run snapshot and execution-contract shapes. */

import type { CatalogProviderBinding } from '@talelabs/models-catalog'
import type { GenerationProviderLifecycle } from '../../generation/contracts/provider.js'
import type {
  FlowRunPlan,
} from '../planning/planner-contracts.js'

import { CatalogProviderBindingSchema } from '@talelabs/models-catalog'
import { z } from 'zod'

import { canonicalByteLength } from '../serialization/canonical-hash.js'
import {
  CANONICAL_SERIALIZER_VERSION,
} from '../serialization/canonical-json.js'
import { deepFreeze } from '../serialization/deep-freeze.js'
import { hashFlowRunSnapshot } from '../serialization/plan-hashes.js'
import { assertSafeSnapshotValue } from './value-safety.js'

export * from './artifact-reader.js'
export * from './execution-contract-reader.js'
export * from './job-request-reader.js'

/** Current serialized plan shape version accepted by admission and workers. */
export const FLOW_RUN_PLAN_VERSION = 3 as const
/** Deterministic planner implementation version captured in every snapshot. */
export const FLOW_RUN_PLANNER_VERSION = 'catalog-runtime.2' as const
/** Current immutable snapshot envelope version. */
export const FLOW_RUN_SNAPSHOT_VERSION = 3 as const

/** Selects whether an admitted run may cross a paid provider boundary. */
export type FlowRunExecutionMode = 'debug' | 'live'

/** Selects the environment that performs admitted provider lifecycle work. */
export type FlowRunExecutionRuntime = 'browser' | 'managed'

/** Private provider execution facts frozen for one planned node. */
export interface FlowRunSnapshotExecutionContract {
  adapterVersion: string
  catalogRevision: string
  catalogVersion: number
  modelContractVersion: string
  modelId: string
  modelRevision: number
  nodeId: string
  operationId: string
  /** Provider implementation selected during admission. */
  provider: string
  /** Server-only endpoint identity captured during admission. */
  providerEndpoint: string
  /** Exact reviewed provider endpoint slug captured during admission. */
  providerEndpointTag: string
  /** Provider lifecycle facts executed by the worker. */
  providerLifecycle: GenerationProviderLifecycle
  providerModel: string
  providerBinding: CatalogProviderBinding
  providerRouteVersion: string
}

/** Versioned immutable snapshot envelope consumed by durable workers. */
export interface FlowRunSnapshot<Plan extends object = object> {
  adapterContractVersion: string
  canonicalSerializerVersion: typeof CANONICAL_SERIALIZER_VERSION
  catalogRevision: string
  executionContracts: readonly FlowRunSnapshotExecutionContract[]
  /** Missing only on historical snapshots, where it is interpreted as live. */
  executionMode?: FlowRunExecutionMode
  /** Missing on historical snapshots, where it is interpreted as managed. */
  executionRuntime?: FlowRunExecutionRuntime
  executorVersion: string
  plan: Plan
  plannerVersion: typeof FLOW_RUN_PLANNER_VERSION
  snapshotVersion: typeof FLOW_RUN_SNAPSHOT_VERSION
}

/** Canonically sized and hashed snapshot artifact persisted at admission. */
export interface FlowRunSnapshotArtifact<Plan extends object> {
  bytes: number
  hash: string
  snapshot: FlowRunSnapshot<Plan>
}

/** Planner output shape after strict snapshot parsing and hash verification. */
export type ReadableFlowRunPlanSnapshot = FlowRunPlan & { planHash: string }

/** Stable failure codes emitted while reading immutable snapshot artifacts. */
export type FlowRunSnapshotReadErrorCode
  = | 'snapshot_executor_incompatible'
    | 'snapshot_hash_mismatch'
    | 'snapshot_invalid'
    | 'snapshot_version_unsupported'

/** Typed fail-closed snapshot reading failure. */
export class FlowRunSnapshotReadError extends TypeError {
  readonly code: FlowRunSnapshotReadErrorCode

  constructor(code: FlowRunSnapshotReadErrorCode) {
    super(code)
    this.code = code
    this.name = 'FlowRunSnapshotReadError'
  }
}

/** Builds and hashes an allowlisted, versioned snapshot envelope. */
export function createFlowRunSnapshotArtifact<Plan extends object>(
  snapshot: FlowRunSnapshot<Plan>,
): FlowRunSnapshotArtifact<Plan> {
  if (snapshot.snapshotVersion !== FLOW_RUN_SNAPSHOT_VERSION)
    throw new TypeError('unsupported_snapshot_version')
  if (snapshot.canonicalSerializerVersion !== CANONICAL_SERIALIZER_VERSION)
    throw new TypeError('unsupported_canonical_serializer_version')
  if (snapshot.plannerVersion !== FLOW_RUN_PLANNER_VERSION)
    throw new TypeError('unsupported_planner_version')
  if (!/^sha256:[0-9a-f]{64}$/.test(snapshot.catalogRevision))
    throw new TypeError('invalid_catalog_revision')
  assertSafeSnapshotValue(snapshot)
  const bytes = canonicalByteLength(snapshot)
  const hash = hashFlowRunSnapshot(snapshot)
  return Object.freeze({
    bytes,
    hash,
    snapshot: deepFreeze(snapshot),
  })
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
/** Strict runtime schema for one persisted provider-neutral job payload. */
export const requestPayloadSchema = z.object({
  catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  catalogVersion: positiveInteger,
  inline: stringMap,
  inputSelections: z.record(z.string(), z.array(z.string())),
  inputs: z.array(plannedInputSchema),
  itemKey: z.string(),
  modelContractVersion: z.string(),
  modelId: z.string(),
  modelRevision: positiveInteger,
  nodeId: z.string(),
  operationId: z.string(),
  outputCount: positiveInteger,
  requestIndex: nonnegativeInteger,
  requestPayloadVersion: z.literal(3),
  settings: settingMap,
}).strict()

/** Stable failure codes emitted while reading planned job requests. */
export type FlowRunJobRequestReadErrorCode
  = | 'job_request_hash_mismatch'
    | 'job_request_invalid'
    | 'job_request_too_large'

/** Typed fail-closed planned-job request reading failure. */
export class FlowRunJobRequestReadError extends TypeError {
  readonly code: FlowRunJobRequestReadErrorCode

  constructor(code: FlowRunJobRequestReadErrorCode) {
    super(code)
    this.code = code
    this.name = 'FlowRunJobRequestReadError'
  }
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
/** Strict runtime schema for current immutable planner output. */
export const readablePlanSchema = z.object({
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
    catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    catalogVersion: positiveInteger,
    inclusionReason: z.enum(['dependency', 'descendant', 'selected', 'target']),
    level: nonnegativeInteger,
    modelContractVersion: z.string(),
    modelId: z.string(),
    modelRevision: positiveInteger,
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

/** Strict runtime schema for private execution facts captured at admission. */
export const executionContractSchema = z.object({
  adapterVersion: z.string(),
  catalogRevision: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  catalogVersion: positiveInteger,
  modelContractVersion: z.string(),
  modelId: z.string(),
  modelRevision: positiveInteger,
  nodeId: z.string(),
  operationId: z.string(),
  provider: z.string(),
  providerEndpoint: z.string(),
  providerEndpointTag: z.string().min(1),
  providerLifecycle: z.discriminatedUnion('submission', [
    z.object({
      cancellation: z.enum(['best-effort', 'supported', 'unsupported']),
      completions: z.tuple([z.literal('response')]),
      deliveries: z.tuple(
        [z.enum(['bytes', 'storage', 'stream', 'text', 'url'])],
        z.enum(['bytes', 'storage', 'stream', 'text', 'url']),
      ),
      submission: z.literal('immediate'),
    }).strict(),
    z.object({
      cancellation: z.enum(['best-effort', 'supported', 'unsupported']),
      completions: z.union([
        z.tuple([z.literal('poll')]),
        z.tuple([z.literal('webhook')]),
        z.tuple([z.literal('poll'), z.literal('webhook')]),
        z.tuple([z.literal('webhook'), z.literal('poll')]),
      ]),
      deliveries: z.tuple(
        [z.enum(['bytes', 'storage', 'stream', 'text', 'url'])],
        z.enum(['bytes', 'storage', 'stream', 'text', 'url']),
      ),
      submission: z.literal('asynchronous'),
    }).strict(),
  ]),
  providerModel: z.string(),
  providerBinding: CatalogProviderBindingSchema,
  providerRouteVersion: z.string(),
}).strict()
