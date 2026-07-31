/**
 * Browser/managed finalization fixture for the disposable Projects verifier.
 *
 * This module creates production-shaped run items and jobs, changes mutable
 * source defaults, then proves canonical Assets use only the run capture.
 */

import { db, lockFolderStructure } from '@talelabs/db'

import {
  persistAssetOutputIfJobRunning,
} from '../../../packages/trigger/src/flow-runs/execution/outputs/asset-persistence.js'
import { lockProjectScopes } from '../src/domain/projects/project-scope.js'

/** Inputs identifying the one isolated destination-parity fixture. */
export interface FinalizationParityInput {
  /** Folder captured before mutable source changes. */
  capturedFolderId: null | string
  /** Project captured before mutable source changes. */
  capturedProjectId: null | string
  /** Current Flow whose defaults change after admission. */
  flowId: string
  /** Alternative Project default used after the run capture. */
  nextDefaultFolderId: string
  /** Active tenant owning every fixture row. */
  organizationId: string
  /** Project owning the Flow and captured destination. */
  projectId: string
  /** Alternative Flow output folder used after the run capture. */
  sourceFolderId: string
  /** Per-process suffix keeping fixture identities unique. */
  suffix: string
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition)
    throw new Error(`projects_verification_failed:${label}`)
}

async function expectRejected(
  operation: () => Promise<unknown>,
  label: string,
) {
  let rejected = false
  try {
    await operation()
  }
  catch {
    rejected = true
  }
  assert(rejected, label)
}

async function insertFinalizableRun(input: FinalizationParityInput & {
  executionRuntime: 'browser' | 'managed'
  jobId: string
  runId: string
}) {
  const nodeId = `node-${input.executionRuntime}-${input.suffix}`
  const itemKey = `item-${input.executionRuntime}-${input.suffix}`
  await db.insertInto('flowRuns').values({
    assetFolderId: input.capturedFolderId,
    browserExecutorStatus: input.executionRuntime === 'browser'
      ? 'ready'
      : null,
    browserExecutorUpdatedAt: input.executionRuntime === 'browser'
      ? new Date()
      : null,
    createdBy: null,
    executionRuntime: input.executionRuntime,
    executorVersion: 'projects-runtime-verifier',
    flowId: input.flowId,
    graphSnapshot: {},
    id: input.runId,
    idempotencyKey: `idempotency-${input.runId}`,
    mode: 'all',
    organizationId: input.organizationId,
    projectId: input.capturedProjectId,
    requestHash: `request-${input.runId}`,
    snapshotHash: 'a'.repeat(64),
    snapshotVersion: 5,
    source: 'flow',
    status: 'running',
    targetNodeId: null,
  }).execute()
  await db.insertInto('flowRunNodes').values({
    flowRunId: input.runId,
    nodeId,
    organizationId: input.organizationId,
    status: 'running',
  }).execute()
  await db.insertInto('flowRunNodeItems').values({
    flowRunId: input.runId,
    itemKey,
    nodeId,
    organizationId: input.organizationId,
    sortOrder: 0,
    status: 'running',
  }).execute()
  await db.insertInto('generationJobs').values({
    adapterVersion: 'projects-runtime-verifier',
    catalogRevision: 'projects-runtime-verifier',
    createdBy: null,
    flowId: input.flowId,
    flowRunId: input.runId,
    id: input.jobId,
    idempotencyKey: `idempotency-${input.jobId}`,
    itemKey,
    mediaType: 'image',
    model: 'verifier/image',
    nodeId,
    operation: 'text-to-image',
    organizationId: input.organizationId,
    provider: 'mock',
    providerModel: 'verifier/image',
    providerRouteVersion: 'projects-runtime-verifier',
    requestHash: `request-${input.jobId}`,
    requestPayload: {
      legacyJobId: input.jobId,
      requestPayloadVersion: 0,
    },
    resolvedPrompt: 'Projects verification',
    settings: {},
    status: 'running',
  }).execute()
  return { itemKey, nodeId }
}

/** Verifies both execution runtimes materialize the same immutable capture. */
export async function verifyCapturedFinalizationParity(
  input: FinalizationParityInput,
) {
  const browserRunId = `browser-run-${input.suffix}`
  const managedRunId = `managed-run-${input.suffix}`
  const browserJobId = `browser-job-${input.suffix}`
  const managedJobId = `managed-job-${input.suffix}`
  const browserJob = await insertFinalizableRun({
    ...input,
    executionRuntime: 'browser',
    jobId: browserJobId,
    runId: browserRunId,
  })
  const managedJob = await insertFinalizableRun({
    ...input,
    executionRuntime: 'managed',
    jobId: managedJobId,
    runId: managedRunId,
  })
  await db.transaction().execute(async (trx) => {
    await lockProjectScopes(trx, input.organizationId, [input.projectId])
    await lockFolderStructure(trx, input.organizationId)
    await trx.updateTable('projects')
      .set({ defaultAssetFolderId: input.nextDefaultFolderId })
      .where('id', '=', input.projectId)
      .execute()
    await trx.updateTable('flows')
      .set({ assetFolderId: input.sourceFolderId })
      .where('id', '=', input.flowId)
      .execute()
  })

  const finalizations = [
    {
      assetId: `browser-asset-${input.suffix}`,
      flowRunId: browserRunId,
      id: browserJobId,
      ...browserJob,
    },
    {
      assetId: `managed-asset-${input.suffix}`,
      flowRunId: managedRunId,
      id: managedJobId,
      ...managedJob,
    },
  ]
  for (const item of finalizations) {
    const result = await persistAssetOutputIfJobRunning({
      assetId: item.assetId,
      job: {
        createdBy: null,
        flowId: input.flowId,
        flowRunId: item.flowRunId,
        id: item.id,
        itemKey: item.itemKey,
        mediaType: 'image',
        model: 'verifier/image',
        nodeId: item.nodeId,
        organizationId: input.organizationId,
        outputVisibility: 'private',
        showcaseEligible: false,
      },
      key: `projects-runtime/${item.assetId}`,
      mimeType: 'image/png',
      outputIndex: 0,
      visibility: 'private',
    })
    assert(result.persisted, `${item.id}_output_persisted`)
  }
  const persistedAssets = await db.selectFrom('assets')
    .select(['folderId', 'projectId'])
    .where('id', 'in', finalizations.map(item => item.assetId))
    .execute()
  assert(persistedAssets.length === 2, 'both_runtime_assets_exist')
  assert(
    persistedAssets.every(asset => (
      asset.folderId === input.capturedFolderId
      && asset.projectId === input.capturedProjectId
    )),
    'browser_managed_use_same_capture',
  )
  await expectRejected(
    () => db.updateTable('flowRuns')
      .set({ assetFolderId: input.nextDefaultFolderId })
      .where('id', '=', browserRunId)
      .execute(),
    'captured_destination_is_immutable',
  )
}
