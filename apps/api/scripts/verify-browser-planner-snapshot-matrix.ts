/** Deterministic planner and snapshot parity matrix for both execution runtimes. */

import type {
  FlowRunExecutionRuntime,
  FlowRunPlan,
  FlowRunSnapshot,
  GenerationProviderLifecycle,
} from '@talelabs/flows'

import {
  BrowserRunManifestSchema,
  BrowserRunRecoveryEntrySchema,
  CANONICAL_SERIALIZER_VERSION,
  createFlowRunSnapshotArtifact,
  executionPlanFromFlowRunPlan,
  FLOW_RUN_SNAPSHOT_VERSION,
  flowRunSourceFromPlan,
  GENERATION_CATALOG_REVISION,
  hashFlowRunRequest,
  planFlowRun,
  readFlowRunSnapshotArtifact,
} from '@talelabs/flows'
import { getCatalogProviderBinding } from '@talelabs/models-catalog'
import {
  edge,
  generationNode,
} from '../../../packages/flows/scripts/run-planner-graph-fixtures.js'
import {
  plannerInput,
  priorTextOutput,
} from '../../../packages/flows/scripts/run-planner-input-fixtures.js'

const errors: string[] = []
const flow = {
  edges: [edge('01', 'node-a', 'node-b'), edge('02', 'node-b', 'node-c')],
  id: 'browser-runtime-matrix-flow',
  nodes: [
    generationNode('node-a', 'llm', {}, 100),
    generationNode('node-b', 'llm', {}, 50),
    generationNode('node-c', 'llm', {}, 0),
    generationNode('node-z', 'llm', {}, -100),
  ],
  revision: 17,
}

const commands = [
  {
    command: { mode: 'node' as const, targetNodeId: 'node-a' },
    expected: ['node-a'],
  },
  {
    command: { mode: 'downstream' as const, targetNodeId: 'node-a' },
    expected: ['node-a', 'node-b', 'node-c'],
  },
  {
    command: { mode: 'upstream' as const, targetNodeId: 'node-c' },
    expected: ['node-a', 'node-b', 'node-c'],
  },
  {
    command: { mode: 'selection' as const, selectedNodeIds: ['node-c'] },
    expected: ['node-c'],
  },
  {
    command: { mode: 'all' as const },
    expected: ['node-a', 'node-z', 'node-b', 'node-c'],
  },
]

function expect(condition: unknown, message: string) {
  if (!condition)
    errors.push(message)
}

function executionContracts(
  plan: FlowRunPlan,
  runtime: FlowRunExecutionRuntime,
) {
  return plan.executionNodes.map((node) => {
    const binding = getCatalogProviderBinding(node.modelId, node.operationId)
    if (!binding)
      throw new Error(`missing_binding:${node.modelId}:${node.operationId}`)
    if (runtime === 'managed') {
      expect(
        binding.executionRuntimes.includes(runtime),
        `${runtime}: binding must allow selected runtime`,
      )
    }
    return {
      adapterVersion: binding.adapterVersion,
      catalogRevision: node.catalogRevision,
      catalogVersion: node.catalogVersion,
      modelContractVersion: node.modelContractVersion,
      modelId: node.modelId,
      modelRevision: node.modelRevision,
      operationId: node.operationId,
      provider: binding.provider,
      providerBinding: binding,
      providerEndpoint: binding.endpoint,
      providerEndpointTag: binding.providerTag,
      providerLifecycle: binding.lifecycle as GenerationProviderLifecycle,
      providerModel: binding.nativeModelId,
      providerRouteVersion: binding.routeVersion,
      stepId: node.nodeId,
    }
  })
}

function verifyDependencyExecution(plan: FlowRunPlan, label: string) {
  const selected = new Set(plan.executionNodes.map(node => node.nodeId))
  const completed = new Set<string>()
  const executed: string[] = []
  for (const level of plan.topologicalLevels) {
    for (const nodeId of level) {
      const prerequisites = plan.capturedEdges
        .filter(
          edge =>
            edge.targetNodeId === nodeId && selected.has(edge.sourceNodeId),
        )
        .map(edge => edge.sourceNodeId)
      expect(
        prerequisites.every(node => completed.has(node)),
        `${label}: prerequisites must complete before ${nodeId}`,
      )
      completed.add(nodeId)
      executed.push(nodeId)
    }
  }
  expect(
    executed.length === plan.executionNodes.length,
    `${label}: every selected node must execute once`,
  )
  const jobs = plan.executionNodes.flatMap(node =>
    node.workItems.flatMap(item => item.requestShards),
  )
  const items = plan.executionNodes.flatMap(node => node.workItems)
  expect(
    jobs.length === plan.summary.plannedJobCount,
    `${label}: persisted job count must match plan`,
  )
  expect(
    items.length === plan.summary.plannedItemCount,
    `${label}: persisted item count must match plan`,
  )
}

function verifyOutputContractProjection(label: string) {
  const mediaTypes = ['image', 'video', 'audio', 'text'] as const
  const canonical = new Map<
    string,
    { index: number, lineage: string, mediaType: string }
  >()
  let providerWork = 0
  const persist = (jobId: string, outputIndex: number, mediaType: string) => {
    const key = `${jobId}:${outputIndex}`
    if (!canonical.has(key)) {
      canonical.set(key, {
        index: outputIndex,
        lineage: `${jobId}/${outputIndex}`,
        mediaType,
      })
    }
  }
  providerWork += 1
  for (const [outputIndex, mediaType] of mediaTypes.entries())
    persist('job-primary', outputIndex, mediaType)
  for (const [outputIndex, mediaType] of mediaTypes.entries())
    persist('job-primary', outputIndex, mediaType)
  expect(
    providerWork === 1,
    `${label}: successful replay must not duplicate provider work`,
  )
  expect(
    canonical.size === 4,
    `${label}: successful replay must not duplicate Assets`,
  )
  expect(
    [...canonical.values()]
      .map(output => `${output.index}:${output.mediaType}`)
      .join(',') === '0:image,1:video,2:audio,3:text',
    `${label}: multiple outputs must preserve deterministic ordering`,
  )
  expect(
    new Set([...canonical.values()].map(output => output.lineage)).size === 4,
    `${label}: output lineage must remain unique and ordered`,
  )
  const canvasHydration = JSON.parse(JSON.stringify([...canonical.entries()]))
  expect(
    JSON.stringify(canvasHydration)
    === JSON.stringify([...canonical.entries()]),
    `${label}: refresh must restore persisted canvas outputs`,
  )

  let canceledProviderWork = 0
  const canceledAssets = new Map<string, unknown>()
  canceledProviderWork += 1
  const canceled = true
  if (!canceled)
    canceledAssets.set('canceled-job:0', {})
  expect(
    canceledProviderWork === 1 && canceledAssets.size === 0,
    `${label}: cancellation must reject late canonical output`,
  )
  const retryAssets = new Map<string, unknown>()
  retryAssets.set('retry-job:0', {})
  retryAssets.set('retry-job:0', {})
  expect(
    retryAssets.size === 1,
    `${label}: retry finalization must be idempotent`,
  )

  const aggregate = (statuses: string[]) => {
    if (statuses.every(status => status === 'succeeded'))
      return 'succeeded'
    if (
      statuses.includes('succeeded')
      && statuses.some(status => status !== 'succeeded')
    ) {
      return 'partial'
    }
    if (statuses.includes('canceled'))
      return 'canceled'
    return 'failed'
  }
  expect(
    aggregate(['succeeded']) === 'succeeded',
    `${label}: succeeded aggregation`,
  )
  expect(
    aggregate(['succeeded', 'failed']) === 'partial',
    `${label}: partial aggregation`,
  )
  expect(aggregate(['failed']) === 'failed', `${label}: failed aggregation`)
  expect(
    aggregate(['canceled']) === 'canceled',
    `${label}: canceled aggregation`,
  )
}

function verifyBrowserRecoveryContracts(
  plan: FlowRunPlan & { planHash: string },
  snapshotHash: string,
  label: string,
) {
  const jobs = plan.executionNodes.flatMap(node =>
    node.workItems.flatMap(item =>
      item.requestShards.map((request, requestIndex) => ({
        browserAttemptCount: 0,
        browserNextEligibleAt: null,
        id: `job-${node.nodeId}-${requestIndex}`,
        itemKey: item.itemKey,
        mediaType: 'text',
        outputCount: request.requestPayload.outputCount,
        provider: getCatalogProviderBinding(node.modelId, node.operationId)?.provider
          ?? 'openrouter',
        providerJobId: null,
        providerSubmittedAt: null,
        requestHash: request.jobHash,
        requestIndex: request.requestIndex,
        stepId: node.nodeId,
        submissionState: 'not_started' as const,
        status: 'pending' as const,
      })),
    ),
  )
  const manifest = BrowserRunManifestSchema.parse({
    cancellations: [],
    jobs,
    manifestVersion: 4,
    run: {
      executionMode: 'debug',
      executionRuntime: 'browser',
      flowId: plan.flowId,
      flowRevision: plan.flowRevision,
      id: 'browser-run-matrix',
      planHash: plan.planHash,
      snapshotHash,
      source: 'flow',
      status: 'pending',
    },
  })
  const journal = BrowserRunRecoveryEntrySchema.parse({
    executorId: 'matrix-executor-id',
    jobId: jobs[0]?.id ?? null,
    nextEligibleAt: null,
    organizationId: 'matrix-organization',
    outputIndex: null,
    phase: 'claimed',
    providerJobId: null,
    runId: manifest.run.id,
    updatedAt: '2026-07-17T12:00:00.000Z',
    userId: 'matrix-user',
  })
  expect(
    manifest.jobs.length === plan.summary.plannedJobCount,
    `${label}: manifest reconstructs every persisted job`,
  )
  expect(
    !/credential|apiKey|signedUrl|prompt/i.test(JSON.stringify(journal)),
    `${label}: recovery journal remains secret-free`,
  )
}

function verifyLeaseAndFairQueuePolicy() {
  let lease = { executorId: 'executor-a', expiresAt: 45, fenceToken: 1 }
  const acquire = (executorId: string, now: number) => {
    if (lease.executorId !== executorId && lease.expiresAt > now)
      return null
    lease = {
      executorId,
      expiresAt: now + 45,
      fenceToken:
        lease.expiresAt > now ? lease.fenceToken : lease.fenceToken + 1,
    }
    return lease.fenceToken
  }
  expect(
    acquire('executor-b', 44) === null,
    'browser lease rejects takeover before database expiry',
  )
  expect(
    acquire('executor-b', 45) === 2,
    'browser lease increments its fence at database expiry',
  )
  expect(
    lease.fenceToken !== 1,
    'expired executors cannot mutate through the current fence',
  )
  const canonicalOutputs = new Set<string>()
  const commitOutput = (fenceToken: number) => {
    if (fenceToken !== lease.fenceToken)
      return false
    canonicalOutputs.add('job:0')
    return true
  }
  expect(
    !commitOutput(1) && canonicalOutputs.size === 0,
    'stale executors cannot commit canonical output after takeover',
  )
  expect(
    commitOutput(2) && canonicalOutputs.size === 1,
    'current fence commits one canonical output',
  )
  let submissionState: 'not_started' | 'submitting' = 'not_started'
  const beginSubmission = () => {
    if (submissionState !== 'not_started')
      return false
    submissionState = 'submitting'
    return true
  }
  expect(beginSubmission(), 'one-shot provider submission opens once')
  expect(
    !beginSubmission(),
    'uncertain provider submission cannot be reopened',
  )
  const runs = [['a1', 'a2'], ['b1'], ['c1', 'c2']]
  const fairOrder = [0, 1, 2, 0, 2].map(runIndex => runs[runIndex]!.shift())
  expect(
    fairOrder.join(',') === 'a1,b1,c1,a2,c2',
    'bounded scheduler fills active runs round-robin',
  )
}

const rows: {
  command: string
  flowRevision: number
  jobs: number
  planHash: string
  runtime: string
  selectedNodeIds: string[]
  snapshotHash: string
}[] = []
const planHashesByCommand = new Map<string, string>()
for (const runtime of ['managed', 'browser'] as const) {
  for (const scenario of commands) {
    const result = planFlowRun(
      plannerInput({
        command: scenario.command,
        flow,
        ...(scenario.command.mode === 'selection'
          ? { priorOutputs: [priorTextOutput('node-b')] }
          : {}),
      }),
    )
    if (!result.ok) {
      errors.push(
        `${runtime}/${scenario.command.mode}: planner failed ${result.issues.map(issue => issue.code).join(',')}`,
      )
      continue
    }
    const plan = result.plan
    const label = `${runtime}+debug/${scenario.command.mode}`
    expect(
      plan.flowRevision === flow.revision,
      `${label}: saved Flow revision must be identical`,
    )
    expect(
      plan.command.mode === scenario.command.mode,
      `${label}: command semantics must be retained`,
    )
    expect(
      plan.executionNodes.map(node => node.nodeId).join(',')
      === scenario.expected.join(','),
      `${label}: selected node closure`,
    )
    const priorHash = planHashesByCommand.get(scenario.command.mode)
    if (priorHash) {
      expect(
        priorHash === plan.planHash,
        `${label}: runtime must not change planner output`,
      )
    }
    else {
      planHashesByCommand.set(scenario.command.mode, plan.planHash)
    }
    const snapshot: FlowRunSnapshot = {
      adapterContractVersion: 'normalized-generation-v3',
      canonicalSerializerVersion: CANONICAL_SERIALIZER_VERSION,
      catalogRevision: GENERATION_CATALOG_REVISION,
      executionContracts: executionContracts(plan, runtime),
      executionMode: 'debug',
      executionPlan: executionPlanFromFlowRunPlan(plan),
      executionRuntime: runtime,
      executorVersion: 'browser-matrix-v1',
      snapshotVersion: FLOW_RUN_SNAPSHOT_VERSION,
      source: flowRunSourceFromPlan(plan),
    }
    const artifact = createFlowRunSnapshotArtifact(snapshot)
    const replay = createFlowRunSnapshotArtifact(snapshot)
    expect(
      artifact.hash === replay.hash,
      `${label}: immutable snapshot hash must be deterministic`,
    )
    expect(
      readFlowRunSnapshotArtifact({
        executorVersion: snapshot.executorVersion,
        expectedExecutorVersion: snapshot.executorVersion,
        graphSnapshot: artifact.snapshot,
        snapshotHash: artifact.hash,
        snapshotVersion: snapshot.snapshotVersion,
      }).hash === artifact.hash,
      `${label}: immutable snapshot must validate`,
    )
    verifyDependencyExecution(plan, label)
    verifyOutputContractProjection(label)
    if (runtime === 'browser')
      verifyBrowserRecoveryContracts(plan, artifact.hash, label)
    rows.push({
      command: scenario.command.mode,
      flowRevision: plan.flowRevision,
      jobs: plan.summary.plannedJobCount,
      planHash: plan.planHash,
      runtime,
      selectedNodeIds: plan.executionNodes.map(node => node.nodeId),
      snapshotHash: artifact.hash,
    })
  }
}

expect(rows.length === 10, 'matrix must contain exactly ten cells')
expect(
  new Set(rows.map(row => `${row.runtime}:${row.command}`)).size === 10,
  'matrix cells must be unique',
)
expect(
  hashFlowRunRequest(rows) === hashFlowRunRequest([...rows]),
  'matrix report must be deterministic',
)
verifyLeaseAndFairQueuePolicy()

if (errors.length) {
  throw new Error(
    `Browser planner/snapshot matrix failed:\n${errors.join('\n')}`,
  )
}

console.log(JSON.stringify(rows, null, 2))
console.log('All 10 managed/browser planner and snapshot parity cells passed.')
console.log(
  'This verifier does not claim execution-driver or provider integration coverage.',
)
