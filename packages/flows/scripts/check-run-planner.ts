/** Executable acceptance scenarios for Flow planning and request materialization. */

import type {
  PriorNodeOutputDescriptor,
  RuntimeAssetCollectionValue,
} from '../src/index.js'

import {
  collectRuntimeAssetItems,
  createIteratorItems,
  createRuntimeItem,
  materializeGenerationProviderRequest,
  planFlowRun,
} from '../src/index.js'
import {
  runPlannerErrors as errors,
  expectRunPlanner as expect,
  expectRunPlannerFailure as expectFailure,
  expectRunPlannerSuccess as expectSuccess,
} from './run-planner-assertions.js'
import { edge, generationNode, sourceNode } from './run-planner-graph-fixtures.js'
import { plannerInput, priorTextOutput } from './run-planner-input-fixtures.js'
import { verifyRunPlannerPromptScenarios } from './run-planner-prompt-scenarios.js'
import { verifyRunPlannerSnapshotScenarios } from './run-planner-snapshot-scenarios.js'

const chainNodes = [
  generationNode('node-a', 'llm', {}, 100),
  generationNode('node-b', 'llm', {}, 50),
  generationNode('node-c', 'llm', {}, 0),
  generationNode('node-z', 'llm', {}, -100),
]
const chainEdges = [
  edge('01', 'node-a', 'node-b'),
  edge('02', 'node-b', 'node-c'),
]
const chainFlow = {
  edges: chainEdges,
  id: 'flow-chain',
  nodes: chainNodes,
  revision: 7,
}

const nodePlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'node-a' },
  flow: chainFlow,
})), 'node command')
expect(nodePlan?.executionNodes.map(node => node.nodeId).join(',') === 'node-a', 'node command must execute only its target')

const downstreamPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'downstream', targetNodeId: 'node-a' },
  flow: chainFlow,
})), 'downstream command')
expect(
  downstreamPlan?.executionNodes.map(node => node.nodeId).join(',')
  === 'node-a,node-b,node-c',
  'downstream must include executable descendants but not disconnected branches',
)

const upstreamPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'upstream', targetNodeId: 'node-c' },
  flow: chainFlow,
})), 'upstream command')
expect(
  upstreamPlan?.executionNodes.map(node => node.nodeId).join(',')
  === 'node-a,node-b,node-c',
  'upstream must include the complete executable ancestor closure',
)

expectFailure(planFlowRun(plannerInput({
  command: { mode: 'selection', selectedNodeIds: ['node-c'] },
  flow: chainFlow,
})), 'missing_upstream_output', 'selection missing prior output')

const selectionPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'selection', selectedNodeIds: ['node-c'] },
  flow: chainFlow,
  priorOutputs: [priorTextOutput('node-b')],
})), 'selection command')
expect(selectionPlan?.summary.requestedExecutableCount === 1, 'selection must preserve the requested executable count')
expect(selectionPlan?.summary.plannedExecutableCount === 1, 'selection must execute selected executable nodes only')
expect(
  selectionPlan?.executionNodes.map(node => node.nodeId).join(',') === 'node-c',
  'selection must not silently execute unselected ancestors',
)
expect(
  selectionPlan?.executionNodes[0]?.inclusionReason === 'selected',
  'selection nodes must carry the selected inclusion reason',
)
expect(
  selectionPlan?.prerequisites.priorOutputs[0]?.generationJobId === 'job-node-b',
  'selection must freeze reused prior output identity in the plan prerequisites',
)

const allPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'all' },
  flow: chainFlow,
})), 'all command')
expect(
  allPlan?.executionNodes.map(node => node.nodeId).join(',')
  === 'node-a,node-z,node-b,node-c',
  'all must include disconnected executable branches in stable topological order',
)

expectFailure(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'node-c' },
  flow: chainFlow,
})), 'missing_upstream_output', 'node missing prior output')

const priorNodePlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'node-c' },
  flow: chainFlow,
  priorOutputs: [priorTextOutput('node-b')],
})), 'node prior output')
expect(
  priorNodePlan?.executionNodes.map(node => node.nodeId).join(',') === 'node-c',
  'node must consume a prior output without silently executing its ancestor',
)
expect(
  priorNodePlan?.prerequisites.priorOutputs[0]?.generationJobId === 'job-node-b',
  'prior output identity must be frozen in the plan prerequisites',
)

const stablePlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'all' },
  flow: {
    ...chainFlow,
    edges: [...chainEdges].reverse(),
    nodes: [...chainNodes]
      .reverse()
      .map(node => ({ ...node, positionX: node.positionX + 9_999 })),
  },
})), 'stable tie-breaking')
expect(stablePlan?.planHash === allPlan?.planHash, 'node order, edge row order, and canvas positions must not change a logical plan hash')

const poemJobPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'writer' },
  flow: {
    edges: [],
    id: 'flow-job-hash-poem',
    nodes: [generationNode('writer', 'llm', { prompt: 'write a poem' })],
    revision: 1,
  },
})), 'job hash prompt payload')
const sqlJobPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'writer' },
  flow: {
    edges: [],
    id: 'flow-job-hash-sql',
    nodes: [generationNode('writer', 'llm', { prompt: 'write SQL' })],
    revision: 1,
  },
})), 'job hash prompt payload mutation')
expect(
  poemJobPlan?.executionNodes[0]?.workItems[0]?.requestShards[0]?.jobHash
  !== sqlJobPlan?.executionNodes[0]?.workItems[0]?.requestShards[0]?.jobHash,
  'job hash must include resolved inline prompt text',
)

const firstFrameSlotPlan = expectSuccess(planFlowRun({
  command: { mode: 'node', targetNodeId: 'slot-target' },
  context: {
    assetTypesById: {
      'asset-first': 'image',
      'asset-last': 'image',
    },
    elementReferencesById: {},
  },
  flow: {
    edges: [
      edge('01', 'slot-first', 'slot-target', 'asset', 'firstFrame'),
      edge('02', 'slot-last', 'slot-target', 'asset', 'lastFrame'),
    ],
    id: 'flow-job-hash-first-frame-slot',
    nodes: [
      sourceNode('slot-first', 'asset', 'asset-first'),
      sourceNode('slot-last', 'asset', 'asset-last'),
      generationNode('slot-target', 'videoGeneration', {
        operationId: 'firstLastFrameToVideo',
        prompt: 'base prompt',
      }),
    ],
    revision: 1,
  },
}), 'job hash first-frame slot')
const swappedFrameSlotPlan = expectSuccess(planFlowRun({
  command: { mode: 'node', targetNodeId: 'slot-target' },
  context: {
    assetTypesById: {
      'asset-first': 'image',
      'asset-last': 'image',
    },
    elementReferencesById: {},
  },
  flow: {
    edges: [
      edge('01', 'slot-first', 'slot-target', 'asset', 'lastFrame'),
      edge('02', 'slot-last', 'slot-target', 'asset', 'firstFrame'),
    ],
    id: 'flow-job-hash-swapped-frame-slots',
    nodes: [
      sourceNode('slot-first', 'asset', 'asset-first'),
      sourceNode('slot-last', 'asset', 'asset-last'),
      generationNode('slot-target', 'videoGeneration', {
        operationId: 'firstLastFrameToVideo',
        prompt: 'base prompt',
      }),
    ],
    revision: 1,
  },
}), 'job hash swapped frame slots')
expect(
  firstFrameSlotPlan?.executionNodes[0]?.workItems[0]?.requestShards[0]?.jobHash
  !== swappedFrameSlotPlan?.executionNodes[0]?.workItems[0]?.requestShards[0]?.jobHash,
  'job hash must include target-slot routing',
)
if (firstFrameSlotPlan && swappedFrameSlotPlan) {
  const firstFrameShard
    = firstFrameSlotPlan.executionNodes[0]!.workItems[0]!.requestShards[0]!
  const swappedFrameShard
    = swappedFrameSlotPlan.executionNodes[0]!.workItems[0]!.requestShards[0]!
  const firstFrameRequest = materializeGenerationProviderRequest({
    requestId: 'job-first-frame',
    requestPayload: firstFrameShard.requestPayload,
  })
  const swappedFrameRequest = materializeGenerationProviderRequest({
    requestId: 'job-swapped-frame',
    requestPayload: swappedFrameShard.requestPayload,
  })
  expect(
    firstFrameRequest.orderedInputs.find(input => input.sourceNodeId === 'slot-first')
      ?.targetSlotId === 'firstFrame',
    'adapter request must preserve first-frame routing',
  )
  expect(
    swappedFrameRequest.orderedInputs.find(input => input.sourceNodeId === 'slot-first')
      ?.targetSlotId === 'lastFrame',
    'adapter request must preserve swapped last-frame routing',
  )
  expect(
    firstFrameRequest.operationId === swappedFrameRequest.operationId
    && firstFrameRequest.operationId === 'firstLastFrameToVideo',
    'slot-sensitive hashes must use the same supported operation',
  )
}

const cycleFlow = {
  edges: [
    edge('01', 'cycle-a', 'cycle-b'),
    edge('02', 'cycle-b', 'cycle-a'),
  ],
  id: 'flow-cycle',
  nodes: [generationNode('cycle-a'), generationNode('cycle-b')],
  revision: 1,
}
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'all' },
  flow: cycleFlow,
})), 'executable_cycle', 'cycle rejection')
const disconnectedCycleFlow = {
  edges: [
    ...cycleFlow.edges,
  ],
  id: 'flow-disconnected-cycle',
  nodes: [
    generationNode('node-a'),
    ...cycleFlow.nodes,
  ],
  revision: 1,
}
expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'node-a' },
  flow: disconnectedCycleFlow,
})), 'targeted command with disconnected cycle')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'all' },
  flow: disconnectedCycleFlow,
})), 'executable_cycle', 'all command with disconnected cycle')
const invalidDownstreamFlow = {
  edges: [edge(
    '01',
    'image-source',
    'invalid-downstream',
    'images',
    'imageReferences',
  )],
  id: 'flow-invalid-downstream',
  nodes: [
    generationNode('image-source', 'imageGeneration'),
    generationNode('invalid-downstream', 'imageGeneration', {
      operationId: 'textToImage',
    }),
  ],
  revision: 1,
}
expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'image-source' },
  flow: invalidDownstreamFlow,
})), 'targeted command with invalid downstream node')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'all' },
  flow: invalidDownstreamFlow,
})), 'derived_operation_mismatch', 'all command with invalid downstream node')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'unknown-node' },
  flow: chainFlow,
})), 'unknown_target_node', 'unknown target rejection')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'selection', selectedNodeIds: ['node-a', 'node-a'] },
  flow: chainFlow,
})), 'selection_duplicate_node', 'duplicate selection rejection')
expectFailure(planFlowRun({
  command: { mode: 'selection', selectedNodeIds: ['asset-node'] },
  context: {
    assetTypesById: { 'asset-1': 'image' },
    elementReferencesById: {},
  },
  flow: {
    edges: [],
    id: 'flow-source-only',
    nodes: [sourceNode('asset-node', 'asset', 'asset-1')],
    revision: 1,
  },
}), 'selection_has_no_executable_node', 'non-executable selection rejection')

const imageSource = generationNode('image-source', 'imageGeneration')
const imageTarget = generationNode('image-target', 'imageGeneration', {
  operationId: 'imageToImage',
})
const imageFlow = {
  edges: [edge(
    '01',
    'image-source',
    'image-target',
    'images',
    'imageReferences',
  )],
  id: 'flow-image-iteration',
  nodes: [imageSource, imageTarget],
  revision: 3,
}
const generationJobId = 'job-image-source'
const imageCollectionItem = createRuntimeItem<RuntimeAssetCollectionValue>({
  key: 'image-collection',
  nodeId: 'image-source',
  value: {
    assets: [0, 1].map(outputIndex => ({
      assetId: `asset-output-${outputIndex}`,
      generationJobId,
      mediaType: 'image' as const,
      outputIndex,
      source: 'priorOutput' as const,
    })),
    kind: 'imageSet',
  },
})
const collectionDescriptor: PriorNodeOutputDescriptor = {
  completedAt: '2026-07-14T12:00:00.000Z',
  generationJobId,
  items: [imageCollectionItem],
  nodeId: 'image-source',
  outputHandleId: 'images',
}
const collectionPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'image-target' },
  flow: imageFlow,
  priorOutputs: [collectionDescriptor],
})), 'inner collection plan')
expect(collectionPlan?.summary.plannedItemCount === 1, 'multiple outputs in one typed collection must remain one execution item')
if (collectionPlan) {
  const shard = collectionPlan.executionNodes[0]!.workItems[0]!.requestShards[0]!
  const firstRequest = materializeGenerationProviderRequest({
    requestId: 'job-image-request',
    requestPayload: shard.requestPayload,
  })
  const secondRequest = materializeGenerationProviderRequest({
    requestId: 'job-image-request',
    requestPayload: shard.requestPayload,
  })
  expect(
    firstRequest.orderedInputs[0]?.items[0]?.assets
      .map(asset => `${asset.order}:${asset.assetId}`)
      .join(',') === '0:asset-output-0,1:asset-output-1',
    'adapter request must preserve exact ordered media Asset inputs',
  )
  expect(
    JSON.stringify(firstRequest) === JSON.stringify(secondRequest),
    'the same immutable job payload must produce the same adapter request',
  )
  if (shard.requestPayload.requestPayloadVersion !== 6)
    throw new Error('planner must emit the current compiled request version')
  const changedAssetRequest = materializeGenerationProviderRequest({
    requestId: 'job-image-request',
    requestPayload: {
      ...shard.requestPayload,
      inputs: shard.requestPayload.inputs.map(plannedInput => ({
        ...plannedInput,
        items: plannedInput.items.map(item => item.value.kind === 'text'
          ? item
          : {
              ...item,
              value: {
                ...item.value,
                assets: item.value.assets.map((asset, index) => index === 0
                  && 'assetId' in asset
                  ? { ...asset, assetId: 'asset-output-changed' }
                  : asset),
              },
            }),
      })),
    },
  })
  expect(
    firstRequest.requestPayloadHash !== changedAssetRequest.requestPayloadHash,
    'adapter request hash must include exact materialized Asset identities',
  )
}

const iteratedItems = createIteratorItems({
  dimensionId: 'image-iterator',
  inputHandleId: 'images',
  item: imageCollectionItem,
  nodeId: 'image-iterator',
  sourceNodeId: 'image-source',
})
const iteratedPlan = expectSuccess(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'image-target' },
  flow: imageFlow,
  priorOutputs: [{ ...collectionDescriptor, items: iteratedItems }],
})), 'explicit iteration plan')
expect(iteratedPlan?.summary.plannedItemCount === 2, 'an explicit iterator dimension must create two work items')
expect(
  iteratedPlan?.executionNodes[0]?.workItems
    .map(item => item.dimensions['image-iterator'])
    .join(',') === '0,1',
  'iterator coordinates must remain explicit and ordered',
)
expect(
  iteratedPlan?.executionNodes[0]?.workItems.every(item =>
    item.lineage[0]?.itemKey
    === iteratedItems.find(input =>
      input.dimensions['image-iterator']
      === item.dimensions['image-iterator'])?.key),
  'work items must preserve the exact iterated input item lineage',
)
expect(
  iteratedItems.every(item => item.lineage[0]?.itemKey === 'image-collection'),
  'iterator items must preserve their source collection lineage',
)
const collected = collectRuntimeAssetItems({
  dimensionId: 'image-iterator',
  inputHandleId: 'images',
  items: iteratedItems,
  nodeId: 'image-collector',
  sourceNodeId: 'image-iterator',
})
expect(collected.value.assets.length === 2, 'Collect must restore the two iterated Assets to one inner collection')
expect(Object.keys(collected.dimensions).length === 0, 'Collect must remove only its explicit iteration dimension')

expectFailure(planFlowRun(plannerInput({
  command: { mode: 'all' },
  flow: chainFlow,
  limits: { executableNodes: 2 },
})), 'run_executable_node_limit', 'executable-node limit')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'all' },
  flow: chainFlow,
  limits: { topologicalDepth: 2 },
})), 'run_topological_depth_limit', 'topological-depth limit')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'selection', selectedNodeIds: ['node-a', 'node-z'] },
  flow: chainFlow,
  limits: { selectionIds: 1 },
})), 'run_selection_limit', 'selection-size limit')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'image-target' },
  flow: imageFlow,
  limits: { itemsPerNode: 1 },
  priorOutputs: [{ ...collectionDescriptor, items: iteratedItems }],
})), 'run_items_per_node_limit', 'items-per-node limit')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'image-target' },
  flow: imageFlow,
  limits: { jobsPerRun: 1 },
  priorOutputs: [{ ...collectionDescriptor, items: iteratedItems }],
})), 'run_job_limit', 'jobs-per-run limit')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'image-target' },
  flow: imageFlow,
  limits: { outputsPerRun: 1 },
  priorOutputs: [{ ...collectionDescriptor, items: iteratedItems }],
})), 'run_output_limit', 'outputs-per-run limit')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'node-a' },
  flow: chainFlow,
  limits: { snapshotBytes: 1 },
})), 'run_snapshot_bytes_limit', 'snapshot-byte limit')
expectFailure(planFlowRun(plannerInput({
  command: { mode: 'node', targetNodeId: 'node-c' },
  flow: chainFlow,
  limits: { dimensionsPerItem: 1 },
  priorOutputs: [priorTextOutput('node-b', [{
    dimensions: { first: '0', second: '0' },
    key: 'two-dimensional-item',
    outputIndex: 0,
    text: 'two dimensions',
  }])],
})), 'run_item_dimension_limit', 'item-dimension limit')

verifyRunPlannerSnapshotScenarios(allPlan)
verifyRunPlannerPromptScenarios()

if (errors.length > 0)
  throw new Error(`Invalid M5.1 run planner scenarios:\n${errors.join('\n')}`)

console.log('M5.1 run planner deterministic scenarios are valid')
