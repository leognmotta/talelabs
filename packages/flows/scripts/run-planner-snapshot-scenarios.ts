/** Deterministic planner and immutable snapshot compatibility scenarios. */

import type {
  FlowRunPlan,
  FlowRunSnapshot,
  GenerationProviderLifecycle,
} from '../src/index.js'

import { getCatalogProviderBinding } from '@talelabs/models-catalog'
import {
  CANONICAL_SERIALIZER_VERSION,
  createFlowRunSnapshotArtifact,
  FLOW_RUN_PLANNER_VERSION,
  FLOW_RUN_SNAPSHOT_VERSION,
  FlowRunSnapshotReadError,
  GENERATION_CATALOG_REVISION,
  hashFlowRunRequest,
  hashFlowRunSnapshot,
  readFlowRunSnapshotArtifact,
} from '../src/index.js'
import {
  expectRunPlanner as expect,
  runPlannerErrors,
} from './run-planner-assertions.js'

/** Verifies deterministic hashing and strict snapshot compatibility behavior. */
export function verifyRunPlannerSnapshotScenarios(
  allPlan: FlowRunPlan | undefined,
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
  const snapshot: FlowRunSnapshot<FlowRunPlan> = {
    adapterContractVersion: 'm5-normalized-adapter-v1',
    canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
    catalogRevision: GENERATION_CATALOG_REVISION,
    executionContracts: allPlan.executionNodes.map((node) => {
      const binding = getCatalogProviderBinding(node.modelId, node.operationId)
      if (!binding)
        throw new Error(`scenario_binding_missing:${node.modelId}:${node.operationId}`)
      return {
        adapterVersion: binding.adapterVersion,
        catalogRevision: node.catalogRevision,
        catalogVersion: node.catalogVersion,
        modelContractVersion: node.modelContractVersion,
        modelId: node.modelId,
        modelRevision: node.modelRevision,
        nodeId: node.nodeId,
        operationId: node.operationId,
        provider: binding.provider,
        providerBinding: binding,
        providerEndpoint: binding.endpoint,
        providerEndpointTag: binding.providerTag,
        providerLifecycle: binding.lifecycle as GenerationProviderLifecycle,
        providerModel: binding.nativeModelId,
        providerRouteVersion: binding.routeVersion,
      }
    }),
    executionMode: 'debug',
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
  expect(
    readFlowRunSnapshotArtifact(persistedSnapshot).snapshot.executionMode
    === 'debug',
    'the shared snapshot reader must preserve the admitted debug execution mode',
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
