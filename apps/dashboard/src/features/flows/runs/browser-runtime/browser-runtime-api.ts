/** Narrow generated-SDK facade for the browser execution driver. */

import type {
  PostRunsIdBrowserJobsJobidCheckpointMutationRequest,
  PostRunsIdBrowserJobsJobidCompleteMutationRequest,
  PostRunsIdBrowserJobsJobidFailMutationRequest,
  PostRunsIdBrowserJobsJobidFinalizeMediaMutationRequest,
  PostRunsIdBrowserJobsJobidFinalizeTextMutationRequest,
  PostRunsIdBrowserJobsJobidOutputGrantMutationRequest,
  PutRunsIdBrowserExecutorStatusMutationRequest,
} from '@talelabs/sdk'

import {
  BrowserRunClaimResponseSchema,
  BrowserRunManifestSchema,
} from '@talelabs/flows'
import {
  deleteRunsIdBrowserLease,
  getRunsActive,
  getRunsId,
  getRunsIdBrowserManifest,
  postRunsIdBrowserJobsClaim,
  postRunsIdBrowserJobsJobidBeginSubmission,
  postRunsIdBrowserJobsJobidCancelAck,
  postRunsIdBrowserJobsJobidCheckpoint,
  postRunsIdBrowserJobsJobidComplete,
  postRunsIdBrowserJobsJobidFail,
  postRunsIdBrowserJobsJobidFinalizeMedia,
  postRunsIdBrowserJobsJobidFinalizeText,
  postRunsIdBrowserJobsJobidOutputGrant,
  putRunsIdBrowserExecutorStatus,
  putRunsIdBrowserLease,
} from '@talelabs/sdk'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'

/** Identity needed before an authoritative browser lease is acquired. */
export interface BrowserLeaseRequestScope {
  /** Tab-scoped executor identity. */
  executorId: string
  /** Active tenant sent with every generated SDK call. */
  organizationId: string
  /** Durable browser-executed Flow run. */
  runId: string
}

/** Current lease generation required by every fenced browser operation. */
export interface BrowserLeasedRunScope extends BrowserLeaseRequestScope {
  /** Monotonic fence token returned by PostgreSQL lease acquisition. */
  fenceToken: number
}

function requestConfig(organizationId: string) {
  return { headers: getOrganizationRequestHeaders(organizationId) }
}

/** Lists active and cancellation-pending browser work through authoritative run state. */
export async function listActiveBrowserRuns(organizationId: string) {
  const response = await getRunsActive(
    {
      params: {
        executionRuntime: 'browser',
        scope: 'mine',
      },
    },
    requestConfig(organizationId),
  )
  return response.data.map(run => run.id).toSorted()
}

/** Loads authoritative run state when reconciling a recovery-only journal entry. */
export function getBrowserRun(organizationId: string, runId: string) {
  return getRunsId({ id: runId }, requestConfig(organizationId))
}

/** Acquires or renews authoritative PostgreSQL ownership for one run. */
export function acquireBrowserLease(scope: BrowserLeaseRequestScope) {
  return putRunsIdBrowserLease(
    {
      data: { executorId: scope.executorId },
      id: scope.runId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Releases only the exact current lease generation. */
export function releaseBrowserLease(scope: BrowserLeasedRunScope) {
  return deleteRunsIdBrowserLease(
    {
      data: { executorId: scope.executorId, fenceToken: scope.fenceToken },
      id: scope.runId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Loads the versioned recovery manifest for a currently fenced run. */
export async function getBrowserManifest(scope: BrowserLeasedRunScope) {
  const manifest = await getRunsIdBrowserManifest(
    {
      id: scope.runId,
      params: { executorId: scope.executorId, fenceToken: scope.fenceToken },
    },
    requestConfig(scope.organizationId),
  )
  return BrowserRunManifestSchema.parse(manifest)
}

/** Claims a bounded set of dependency-ready jobs for local execution. */
export async function claimBrowserJobs(
  scope: BrowserLeasedRunScope,
  input: { activeJobIds: string[], limit: number },
) {
  const response = await postRunsIdBrowserJobsClaim(
    {
      data: {
        ...input,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
    },
    requestConfig(scope.organizationId),
  )
  return BrowserRunClaimResponseSchema.parse(response)
}

/** Opens the durable one-shot provider-submission boundary. */
export function beginBrowserSubmission(
  scope: BrowserLeasedRunScope,
  jobId: string,
) {
  return postRunsIdBrowserJobsJobidBeginSubmission(
    {
      data: { executorId: scope.executorId, fenceToken: scope.fenceToken },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Persists provider identity and unverified browser-reported facts. */
export function checkpointBrowserJob(
  scope: BrowserLeasedRunScope,
  jobId: string,
  data: Omit<
    PostRunsIdBrowserJobsJobidCheckpointMutationRequest,
    'executorId' | 'fenceToken'
  >,
) {
  return postRunsIdBrowserJobsJobidCheckpoint(
    {
      data: {
        ...data,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Requests an exact short-lived upload target for one planned output. */
export function createBrowserOutputGrant(
  scope: BrowserLeasedRunScope,
  jobId: string,
  data: Omit<
    PostRunsIdBrowserJobsJobidOutputGrantMutationRequest,
    'executorId' | 'fenceToken'
  >,
) {
  return postRunsIdBrowserJobsJobidOutputGrant(
    {
      data: {
        ...data,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Persists one verified media upload and dispatches canonical Asset ingestion. */
export function finalizeBrowserMediaOutput(
  scope: BrowserLeasedRunScope,
  jobId: string,
  data: Omit<
    PostRunsIdBrowserJobsJobidFinalizeMediaMutationRequest,
    'executorId' | 'fenceToken'
  >,
) {
  return postRunsIdBrowserJobsJobidFinalizeMedia(
    {
      data: {
        ...data,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Finalizes one ordered text output through canonical output persistence. */
export function finalizeBrowserTextOutput(
  scope: BrowserLeasedRunScope,
  jobId: string,
  data: Omit<
    PostRunsIdBrowserJobsJobidFinalizeTextMutationRequest,
    'executorId' | 'fenceToken'
  >,
) {
  return postRunsIdBrowserJobsJobidFinalizeText(
    {
      data: {
        ...data,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Completes a job after every planned output is ready, or reports processing. */
export function completeBrowserJob(
  scope: BrowserLeasedRunScope,
  jobId: string,
  data: Omit<
    PostRunsIdBrowserJobsJobidCompleteMutationRequest,
    'executorId' | 'fenceToken'
  >,
) {
  return postRunsIdBrowserJobsJobidComplete(
    {
      data: {
        ...data,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Reports an allowlisted executor or provider failure. */
export function failBrowserJob(
  scope: BrowserLeasedRunScope,
  jobId: string,
  data: Omit<
    PostRunsIdBrowserJobsJobidFailMutationRequest,
    'executorId' | 'fenceToken'
  >,
) {
  return postRunsIdBrowserJobsJobidFail(
    {
      data: {
        ...data,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Acknowledges an attempted provider cancellation for a terminal job. */
export function acknowledgeBrowserCancellation(
  scope: BrowserLeasedRunScope,
  jobId: string,
  data: {
    final: boolean
    result: 'accepted' | 'rejected' | 'unavailable' | 'unsupported'
  },
) {
  return postRunsIdBrowserJobsJobidCancelAck(
    {
      data: {
        ...data,
        executorId: scope.executorId,
        fenceToken: scope.fenceToken,
      },
      id: scope.runId,
      jobId,
    },
    requestConfig(scope.organizationId),
  )
}

/** Persists one safe actionable executor state for the run owner. */
export function updateBrowserExecutorStatus(
  organizationId: string,
  runId: string,
  data: PutRunsIdBrowserExecutorStatusMutationRequest,
) {
  return putRunsIdBrowserExecutorStatus(
    { data, id: runId },
    requestConfig(organizationId),
  )
}
