import type { FlowRunPlanV1, FlowRunSnapshotV1 } from '../src/index.js'

import {
  CANONICAL_SERIALIZER_VERSION,
  createFlowRunSnapshotArtifact,
  FLOW_RUN_PLANNER_VERSION,
  FLOW_RUN_SNAPSHOT_VERSION,
  FlowRunSnapshotReadError,
  hashFlowRunRequest,
  hashFlowRunSnapshot,
  readFlowRunSnapshotArtifact,
} from '../src/index.js'
import {
  expectRunPlanner as expect,
  runPlannerErrors,
} from './run-planner-assertions.js'

export function verifyRunPlannerSnapshotScenarios(
  allPlan: FlowRunPlanV1 | undefined,
) {
  const unorderedHashA = hashFlowRunRequest({
    map: new Map([['b', 2], ['a', 1]]),
    set: new Set(['second', 'first']),
  })
  const unorderedHashB = hashFlowRunRequest({
    map: new Map([['a', 1], ['b', 2]]),
    set: new Set(['first', 'second']),
  })
  expect(
    unorderedHashA === unorderedHashB,
    'unordered Map/Set insertion order must not change canonical hashes',
  )
  expect(
    hashFlowRunRequest({ ordered: ['first', 'second'] })
    !== hashFlowRunRequest({ ordered: ['second', 'first'] }),
    'semantically ordered array order must remain hash-significant',
  )
  expect(
    hashFlowRunRequest({ value: 1 }) !== hashFlowRunSnapshot({ value: 1 }),
    'request and snapshot hashes must be domain-separated',
  )

  if (!allPlan)
    return
  const snapshot: FlowRunSnapshotV1<FlowRunPlanV1> = {
    adapterContractVersion: 'm5-normalized-adapter-v1',
    canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
    executionContracts: allPlan.executionNodes.map(node => ({
      adapterVersion: 'mock-v1',
      modelContractVersion: node.modelContractVersion,
      modelId: node.modelId,
      modelRegistryVersion: '2026-07-13.8',
      nodeId: node.nodeId,
      operationId: node.operationId,
      providerModel: 'mock',
      providerRouteVersion: 'mock-v1',
    })),
    executorVersion: 'scenario-v1',
    plan: allPlan,
    plannerVersion: FLOW_RUN_PLANNER_VERSION,
    snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
  }
  const firstArtifact = createFlowRunSnapshotArtifact(snapshot)
  const secondArtifact = createFlowRunSnapshotArtifact(snapshot)
  expect(
    firstArtifact.hash === secondArtifact.hash,
    'the same versioned snapshot must always produce the same integrity hash',
  )
  const persistedSnapshot = {
    executorVersion: snapshot.executorVersion,
    expectedExecutorVersion: snapshot.executorVersion,
    graphSnapshot: firstArtifact.snapshot,
    snapshotHash: firstArtifact.hash,
    snapshotVersion: snapshot.snapshotVersion,
  }
  expect(
    readFlowRunSnapshotArtifact(persistedSnapshot).hash === firstArtifact.hash,
    'the shared snapshot reader must accept a compatible integrity-checked artifact',
  )
  const structurallyInvalidArtifact = createFlowRunSnapshotArtifact({
    ...snapshot,
    plan: {
      ...allPlan,
      executionNodes: allPlan.executionNodes.map((node, index) => index === 0
        ? { ...node, workItems: 'invalid' }
        : node),
    },
  })
  try {
    readFlowRunSnapshotArtifact({
      ...persistedSnapshot,
      graphSnapshot: structurallyInvalidArtifact.snapshot,
      snapshotHash: structurallyInvalidArtifact.hash,
    })
    runPlannerErrors.push(
      'snapshot reader must reject invalid nested execution contracts',
    )
  }
  catch (error) {
    expect(
      error instanceof FlowRunSnapshotReadError
      && error.code === 'snapshot_invalid',
      'nested snapshot validation must return stable snapshot_invalid',
    )
  }
  for (const scenario of [
    {
      code: 'snapshot_hash_mismatch',
      input: { ...persistedSnapshot, snapshotHash: 'tampered' },
    },
    {
      code: 'snapshot_executor_incompatible',
      input: { ...persistedSnapshot, expectedExecutorVersion: 'next-executor' },
    },
    {
      code: 'snapshot_version_unsupported',
      input: { ...persistedSnapshot, snapshotVersion: 0 },
    },
  ] as const) {
    try {
      readFlowRunSnapshotArtifact(scenario.input)
      runPlannerErrors.push(`snapshot reader must reject ${scenario.code}`)
    }
    catch (error) {
      expect(
        error instanceof FlowRunSnapshotReadError
        && error.code === scenario.code,
        `snapshot reader must return stable ${scenario.code}`,
      )
    }
  }
  for (const scenario of [
    {
      expectedCode: 'snapshot_forbidden_field',
      message: 'snapshot forbidden-field rejection must be machine-readable',
      plan: { storageKey: 'forbidden' },
    },
    {
      expectedCode: 'snapshot_forbidden_field',
      message: 'nested forbidden fields must use the stable snapshot error',
      plan: { nested: { r2StorageKey: 'forbidden' } },
    },
    {
      expectedCode: 'snapshot_non_json_value',
      message: 'non-JSON snapshot values must use the stable snapshot error',
      plan: new Map([['node', 'not-json']]),
    },
  ]) {
    try {
      createFlowRunSnapshotArtifact({ ...snapshot, plan: scenario.plan })
      runPlannerErrors.push(scenario.message)
    }
    catch (error) {
      expect(String(error).includes(scenario.expectedCode), scenario.message)
    }
  }
}
