/** Integrity-checked browser recovery manifest over authoritative run rows. */

import { db } from '@talelabs/db'
import {
  BrowserRunManifestSchema,
  readFlowRunExecutionMode,
  readFlowRunJobRequestPayload,
  toBrowserExecutionContract,
} from '@talelabs/flows'

import { requireBrowserRunLease } from './browser-runtime-policy.js'

/** Reads the bounded non-secret manifest for one currently leased browser run. */
export async function getBrowserRunManifest(input: {
  executorId: string
  fenceToken: number
  organizationId: string
  runId: string
  userId: string
}) {
  const run = await requireBrowserRunLease(input)
  const { artifact } = run
  const jobs = await db
    .selectFrom('generationJobs')
    .select([
      'browserAttemptCount',
      'browserCancelAcknowledgedAt',
      'browserCancelFinal',
      'browserCancelRequestedAt',
      'browserNextEligibleAt',
      'browserSubmissionState',
      'id',
      'itemKey',
      'mediaType',
      'nodeId',
      'providerJobId',
      'providerSubmittedAt',
      'requestHash',
      'requestIndex',
      'requestPayload',
      'status',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.runId)
    .orderBy('createdAt')
    .orderBy('id')
    .execute()
  return BrowserRunManifestSchema.parse({
    cancellations: jobs.flatMap((job) => {
      if (
        !job.browserCancelRequestedAt
        || (job.browserCancelAcknowledgedAt && job.browserCancelFinal)
      ) {
        return []
      }
      const executionContract = artifact.snapshot.executionContracts.find(
        contract => contract.nodeId === job.nodeId,
      )
      if (!executionContract)
        throw new Error('browser_cancellation_contract_missing')
      return [
        {
          cancellation: executionContract.providerLifecycle.cancellation,
          executionContract: toBrowserExecutionContract(executionContract),
          jobId: job.id,
          providerJobId: job.providerJobId,
        },
      ]
    }),
    jobs: jobs.map((job) => {
      const request = readFlowRunJobRequestPayload({
        requestHash: job.requestHash,
        requestPayload: job.requestPayload,
      })
      return {
        browserAttemptCount: job.browserAttemptCount,
        browserNextEligibleAt: job.browserNextEligibleAt?.toISOString() ?? null,
        id: job.id,
        itemKey: job.itemKey,
        mediaType: job.mediaType,
        nodeId: job.nodeId,
        outputCount: request.outputCount,
        providerJobId: job.providerJobId,
        providerSubmittedAt: job.providerSubmittedAt?.toISOString() ?? null,
        requestHash: job.requestHash,
        requestIndex: Number(job.requestIndex),
        submissionState: job.browserSubmissionState,
        status: job.status,
      }
    }),
    manifestVersion: 2,
    run: {
      executionMode: readFlowRunExecutionMode(artifact.snapshot.executionMode),
      executionRuntime: 'browser',
      flowRevision: artifact.snapshot.plan.flowRevision,
      id: run.id,
      planHash: artifact.snapshot.plan.planHash,
      snapshotHash: run.snapshotHash,
      status: run.status,
    },
  })
}
