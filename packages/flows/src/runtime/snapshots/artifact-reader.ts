/** Fail-closed reader for versioned immutable Flow run snapshot artifacts. */

import type {
  FlowRunExecutionMode,
  FlowRunExecutionRuntime,
  FlowRunSnapshot,
  FlowRunSnapshotArtifact,
  ReadableFlowRunPlanSnapshot,
} from './contracts.js'

import { z } from 'zod'
import {
  CANONICAL_SERIALIZER_VERSION,
} from '../serialization/canonical-json.js'
import { hashFlowRunSnapshot } from '../serialization/plan-hashes.js'
import {
  createFlowRunSnapshotArtifact,
  executionContractSchema,
  FLOW_RUN_PLANNER_VERSION,
  FLOW_RUN_SNAPSHOT_VERSION,
  FlowRunSnapshotReadError,
  readablePlanSchema,
} from './contracts.js'

const HISTORICAL_FLOW_RUN_SNAPSHOT_VERSION = 3

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
  const supportedVersion = input.snapshotVersion === FLOW_RUN_SNAPSHOT_VERSION
    || input.snapshotVersion === HISTORICAL_FLOW_RUN_SNAPSHOT_VERSION
  if (!supportedVersion
    || !isPlainRecord(input.graphSnapshot)
    || input.graphSnapshot.snapshotVersion !== input.snapshotVersion) {
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
    || typeof input.graphSnapshot.catalogRevision !== 'string'
    || input.graphSnapshot.plannerVersion !== FLOW_RUN_PLANNER_VERSION
    || typeof input.graphSnapshot.adapterContractVersion !== 'string'
    || !Array.isArray(input.graphSnapshot.executionContracts)
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
  readFlowRunExecutionMode(input.graphSnapshot.executionMode)
  readFlowRunExecutionRuntime(input.graphSnapshot.executionRuntime)

  const executionContracts = z.array(executionContractSchema)
    .safeParse(input.graphSnapshot.executionContracts)
  const plan = readablePlanSchema.safeParse(input.graphSnapshot.plan)
  if (!executionContracts.success || !plan.success)
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  const catalogRevision = input.graphSnapshot.catalogRevision
  if (
    !/^sha256:[0-9a-f]{64}$/.test(catalogRevision as string)
    || executionContracts.data.some(
      contract => contract.catalogRevision !== catalogRevision,
    )
    || plan.data.executionNodes.some(
      node => node.catalogRevision !== catalogRevision,
    )
  ) {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }

  if (hashFlowRunSnapshot(input.graphSnapshot) !== input.snapshotHash)
    throw new FlowRunSnapshotReadError('snapshot_hash_mismatch')

  let artifact: FlowRunSnapshotArtifact<object>
  try {
    artifact = createFlowRunSnapshotArtifact(
      {
        ...input.graphSnapshot,
        snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      } as unknown as FlowRunSnapshot<object>,
    )
  }
  catch {
    throw new FlowRunSnapshotReadError('snapshot_invalid')
  }
  return artifact as FlowRunSnapshotArtifact<ReadableFlowRunPlanSnapshot>
}
