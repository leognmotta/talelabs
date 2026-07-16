import type {
  FlowRunSnapshotArtifact,
  FlowRunSnapshotV1,
  ReadableFlowRunPlanSnapshot,
} from './contracts.js'

import { z } from 'zod'
import {
  CANONICAL_SERIALIZER_VERSION,
} from '../serialization/canonical-json.js'
import {
  createFlowRunSnapshotArtifact,
  executionContractSchema,
  FLOW_RUN_PLANNER_VERSION,
  FLOW_RUN_SNAPSHOT_VERSION,
  FlowRunSnapshotReadError,
  readablePlanSchema,
} from './contracts.js'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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
