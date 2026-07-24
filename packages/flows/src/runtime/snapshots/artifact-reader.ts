/**
 * Fail-closed reader for current and historical immutable run snapshots.
 *
 * Historical Flow snapshots are integrity-checked in their original shape and
 * then normalized to the current source plus execution-plan contract.
 */

import type {
  FlowRunExecutionMode,
  FlowRunExecutionRuntime,
  FlowRunSnapshotArtifact,
  ReadableFlowRunPlanSnapshot,
} from './contracts.js'

import { z } from 'zod'
import {
  createExecutionPlan,
  executionPlanFromFlowRunPlan,
  flowRunSourceFromPlan,
} from '../execution-plan/contracts.js'
import {
  CANONICAL_SERIALIZER_VERSION,
} from '../serialization/canonical-json.js'
import { hashFlowRunSnapshot } from '../serialization/plan-hashes.js'
import {
  createFlowRunSnapshotArtifact,
  executionContractSchema,
  executionPlanSchema,
  FLOW_RUN_PLANNER_VERSION,
  FLOW_RUN_SNAPSHOT_VERSION,
  FlowRunSnapshotReadError,
  legacyExecutionContractSchema,
  readablePlanSchema,
  runSourceSchema,
} from './contracts.js'

const HISTORICAL_FLOW_RUN_SNAPSHOT_VERSIONS = new Set([3, 4])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Reads the run-level provider mode while preserving historical snapshots. */
export function readFlowRunExecutionMode(value: unknown): FlowRunExecutionMode {
  if (value === undefined || value === 'live')
    return 'live'
  if (value === 'debug')
    return 'debug'
  throw new FlowRunSnapshotReadError('snapshot_invalid')
}

/** Reads the run driver while preserving managed semantics for old snapshots. */
export function readFlowRunExecutionRuntime(value: unknown): FlowRunExecutionRuntime {
  if (value === undefined || value === 'managed')
    return 'managed'
  if (value === 'browser')
    return 'browser'
  throw new FlowRunSnapshotReadError('snapshot_invalid')
}

function assertCommonEnvelope(input: {
  executorVersion: string
  expectedExecutorVersion: string
  snapshot: Record<string, unknown>
}) {
  if (
    input.executorVersion !== input.expectedExecutorVersion
    || input.snapshot.executorVersion !== input.executorVersion
  ) {
    throw new FlowRunSnapshotReadError('snapshot_executor_incompatible')
  }
  if (
    input.snapshot.canonicalSerializerVersion
    !== CANONICAL_SERIALIZER_VERSION
    || typeof input.snapshot.catalogRevision !== 'string'
    || typeof input.snapshot.adapterContractVersion !== 'string'
    || !Array.isArray(input.snapshot.executionContracts)
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
  readFlowRunExecutionMode(input.snapshot.executionMode)
  readFlowRunExecutionRuntime(input.snapshot.executionRuntime)
}

function verifyPersistedHash(input: {
  snapshot: Record<string, unknown>
  snapshotHash: string
}) {
  if (hashFlowRunSnapshot(input.snapshot) !== input.snapshotHash)
    throw new FlowRunSnapshotReadError('snapshot_hash_mismatch')
}

function readCurrentSnapshot(
  snapshot: Record<string, unknown>,
): FlowRunSnapshotArtifact {
  const contracts = z.array(executionContractSchema)
    .safeParse(snapshot.executionContracts)
  const plan = executionPlanSchema.safeParse(snapshot.executionPlan)
  const source = runSourceSchema.safeParse(snapshot.source)
  if (!contracts.success || !plan.success || !source.success)
    throw new FlowRunSnapshotReadError('snapshot_invalid')

  const canonicalPlan = createExecutionPlan({
    dependencies: plan.data.dependencies,
    levels: plan.data.levels,
    prerequisites: plan.data.prerequisites,
    steps: plan.data.steps,
  })
  if (
    canonicalPlan.executionPlanHash !== plan.data.executionPlanHash
    || canonicalPlan.summary.planBytes !== plan.data.summary.planBytes
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
  const catalogRevision = String(snapshot.catalogRevision)
  const stepIds = new Set(plan.data.steps.map(step => step.stepId))
  if (
    !/^sha256:[0-9a-f]{64}$/.test(catalogRevision)
    || plan.data.steps.some(step => step.catalogRevision !== catalogRevision)
    || contracts.data.some(contract => (
      contract.catalogRevision !== catalogRevision
      || !stepIds.has(contract.stepId)
    ))
    || contracts.data.length !== stepIds.size
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }

  try {
    return createFlowRunSnapshotArtifact({
      adapterContractVersion: String(snapshot.adapterContractVersion),
      canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
      catalogRevision,
      executionContracts: contracts.data,
      executionMode: readFlowRunExecutionMode(snapshot.executionMode),
      executionPlan: canonicalPlan,
      executionRuntime: readFlowRunExecutionRuntime(snapshot.executionRuntime),
      executorVersion: String(snapshot.executorVersion),
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      source: source.data,
    })
  }
  catch {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
}

function readHistoricalFlowSnapshot(
  snapshot: Record<string, unknown>,
): FlowRunSnapshotArtifact {
  if (snapshot.plannerVersion !== FLOW_RUN_PLANNER_VERSION)
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  const contracts = z.array(legacyExecutionContractSchema)
    .safeParse(snapshot.executionContracts)
  const plan = readablePlanSchema.safeParse(snapshot.plan)
  if (!contracts.success || !plan.success)
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  const catalogRevision = String(snapshot.catalogRevision)
  if (
    !/^sha256:[0-9a-f]{64}$/.test(catalogRevision)
    || plan.data.executionNodes.some(
      node => node.catalogRevision !== catalogRevision,
    )
    || contracts.data.some(
      contract => contract.catalogRevision !== catalogRevision,
    )
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
  const historicalPlan = plan.data as unknown as Parameters<
    typeof executionPlanFromFlowRunPlan
  >[0]
  try {
    return createFlowRunSnapshotArtifact({
      adapterContractVersion: String(snapshot.adapterContractVersion),
      canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
      catalogRevision,
      executionContracts: contracts.data.map(({ nodeId, ...contract }) => ({
        ...contract,
        stepId: nodeId,
      })),
      executionMode: readFlowRunExecutionMode(snapshot.executionMode),
      executionPlan: executionPlanFromFlowRunPlan(historicalPlan),
      executionRuntime: readFlowRunExecutionRuntime(snapshot.executionRuntime),
      executorVersion: String(snapshot.executorVersion),
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      source: flowRunSourceFromPlan(historicalPlan),
    })
  }
  catch {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
}

/**
 * Reads a persisted snapshot through one integrity and compatibility boundary.
 * Callers may execute only the returned, validated current artifact.
 */
export function readFlowRunSnapshotArtifact(input: {
  executorVersion: string
  expectedExecutorVersion: string
  graphSnapshot: unknown
  snapshotHash: string
  snapshotVersion: number
}): FlowRunSnapshotArtifact<ReadableFlowRunPlanSnapshot> {
  if (
    !isPlainRecord(input.graphSnapshot)
    || input.graphSnapshot.snapshotVersion !== input.snapshotVersion
  ) {
    throw new FlowRunSnapshotReadError('snapshot_version_unsupported')
  }
  const current = input.snapshotVersion === FLOW_RUN_SNAPSHOT_VERSION
  const historical = HISTORICAL_FLOW_RUN_SNAPSHOT_VERSIONS.has(
    input.snapshotVersion,
  )
  if (!current && !historical)
    throw new FlowRunSnapshotReadError('snapshot_version_unsupported')

  assertCommonEnvelope({
    executorVersion: input.executorVersion,
    expectedExecutorVersion: input.expectedExecutorVersion,
    snapshot: input.graphSnapshot,
  })
  verifyPersistedHash({
    snapshot: input.graphSnapshot,
    snapshotHash: input.snapshotHash,
  })
  return current
    ? readCurrentSnapshot(input.graphSnapshot)
    : readHistoricalFlowSnapshot(input.graphSnapshot)
}
