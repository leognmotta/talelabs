/** Browser-only credential resolution and normalized provider lifecycle execution. */

import type {
  BrowserRunClaimedJob,
  NormalizedGenerationOutput,
  NormalizedGenerationProviderFacts,
} from '@talelabs/flows'
import type { PostRunsIdBrowserJobsJobidFailMutationRequest } from '@talelabs/sdk'

import {
  GenerationProviderError,
  resolveCredential,
} from '@talelabs/providers/browser'

import { transferBrowserOutputs } from './browser-output-transfer'
import { createBrowserProviderAdapter } from './browser-provider-adapter'
import { waitForBrowserProviderPoll } from './browser-provider-polling'
import {
  clearBrowserJobJournal,
  writeBrowserRunJournal,
} from './browser-run-journal'
import {
  beginBrowserSubmission,
  checkpointBrowserJob,
  completeBrowserJob,
  failBrowserJob,
  getBrowserManifest,
} from './browser-runtime-api'

const PROVIDER_POLL_LIMIT_MS = 30 * 60 * 1_000
type BrowserJobFailureCode
  = PostRunsIdBrowserJobsJobidFailMutationRequest['code']

const BROWSER_JOB_FAILURE_CODES = new Set<BrowserJobFailureCode>([
  'generation_failed',
  'provider_authentication',
  'provider_insufficient_balance',
  'provider_rate_limited',
  'provider_rejected',
  'provider_response_invalid',
  'provider_submission_uncertain',
  'provider_timeout',
  'provider_unavailable',
])

function browserJobFailureCode(candidate: unknown): BrowserJobFailureCode {
  return typeof candidate === 'string'
    && BROWSER_JOB_FAILURE_CODES.has(candidate as BrowserJobFailureCode)
    ? (candidate as BrowserJobFailureCode)
    : 'run_execution_failed'
}

interface BrowserJobExecutionScope {
  executorId: string
  fenceToken: number
  organizationId: string
  runId: string
  signal: AbortSignal
  userId: string
}

async function debugOutputs(
  claim: BrowserRunClaimedJob,
): Promise<NormalizedGenerationOutput[]> {
  return (claim.debugOutputs ?? []).map((output) => {
    if (output.delivery === 'text') {
      return {
        mediaType: 'text' as const,
        outputIndex: output.outputIndex,
        payload: {
          delivery: 'text' as const,
          mimeType: 'text/plain' as const,
          text: output.text,
        },
      }
    }
    return {
      mediaType: claim.job.mediaType,
      metadata: output.metadata,
      outputIndex: output.outputIndex,
      payload: {
        delivery: 'url' as const,
        mimeType: output.mimeType,
        url: output.url,
      },
    }
  })
}

async function liveProviderResult(
  claim: BrowserRunClaimedJob,
  scope: BrowserJobExecutionScope,
) {
  const binding = claim.executionContract.providerBinding
  const credential = await resolveCredential({
    providerId: binding.provider,
    userId: scope.userId,
  })
  if (!credential) {
    throw Object.assign(new Error('browser_provider_credential_missing'), {
      code: 'provider_authentication',
    })
  }
  const assets = new Map(
    claim.inputAssets.map(asset => [asset.assetId, asset]),
  )
  const adapter = createBrowserProviderAdapter({
    apiKey: credential,
    binding,
    resolveAsset: async (asset) => {
      const resolved = assets.get(asset.assetId)
      if (!resolved)
        throw new Error('browser_input_asset_missing')
      return resolved
    },
    signal: scope.signal,
  })
  let facts: NormalizedGenerationProviderFacts = {}
  let externalJobId = claim.job.providerJobId
  let pollAfterMs: number | undefined
  if (!externalJobId) {
    if (
      claim.job.submissionState !== 'not_started'
      || claim.job.providerSubmittedAt
    ) {
      throw Object.assign(new Error('provider_submission_uncertain'), {
        code: 'provider_submission_uncertain',
      })
    }
    if (!adapter.prepare)
      throw new Error('browser_provider_prepare_unavailable')
    const submit = await adapter.prepare(claim.request)
    await writeBrowserRunJournal({
      executorId: scope.executorId,
      jobId: claim.job.id,
      nextEligibleAt: null,
      organizationId: scope.organizationId,
      outputIndex: null,
      phase: 'submitting',
      providerJobId: null,
      runId: scope.runId,
      updatedAt: new Date().toISOString(),
      userId: scope.userId,
    })
    const boundary = await beginBrowserSubmission(scope, claim.job.id)
    if (Date.now() >= Date.parse(boundary.submissionExpiresAt)) {
      throw Object.assign(new Error('provider_submission_uncertain'), {
        code: 'provider_submission_uncertain',
      })
    }
    const submission = await submit()
    facts = { ...facts, ...submission.facts }
    if (submission.status === 'completed') {
      await checkpointBrowserJob(scope, claim.job.id, { facts })
      return { facts, outputs: submission.outputs, providerJobId: null }
    }
    externalJobId = submission.externalJobId
    pollAfterMs = submission.pollAfterMs
    await checkpointBrowserJob(scope, claim.job.id, {
      facts,
      providerJobId: externalJobId,
    })
    await writeBrowserRunJournal({
      executorId: scope.executorId,
      jobId: claim.job.id,
      nextEligibleAt: null,
      organizationId: scope.organizationId,
      outputIndex: null,
      phase: 'provider-processing',
      providerJobId: externalJobId,
      runId: scope.runId,
      updatedAt: new Date().toISOString(),
      userId: scope.userId,
    })
  }
  if (!adapter.poll)
    throw new Error('browser_provider_poll_unavailable')
  const startedAt = Date.now()
  while (Date.now() - startedAt < PROVIDER_POLL_LIMIT_MS) {
    await waitForBrowserProviderPoll({
      delayMs: pollAfterMs,
      signal: scope.signal,
    })
    const manifest = await getBrowserManifest(scope)
    if (manifest.run.status === 'canceled')
      throw new DOMException('Run canceled', 'AbortError')
    const completion = await adapter.poll(externalJobId)
    facts = { ...facts, ...completion.facts }
    if (completion.status === 'pending') {
      pollAfterMs = completion.pollAfterMs
      continue
    }
    if (completion.status === 'failed') {
      throw Object.assign(new Error(completion.code), {
        code: completion.code,
      })
    }
    return { facts, outputs: completion.outputs, providerJobId: externalJobId }
  }
  throw Object.assign(new Error('provider_timeout'), {
    code: 'provider_timeout',
  })
}

/** Executes one claimed job and reports only allowlisted failure codes. */
export async function executeBrowserJob(
  claim: BrowserRunClaimedJob,
  scope: BrowserJobExecutionScope,
) {
  try {
    await writeBrowserRunJournal({
      executorId: scope.executorId,
      jobId: claim.job.id,
      nextEligibleAt: null,
      organizationId: scope.organizationId,
      outputIndex: null,
      phase: 'claimed',
      providerJobId: claim.job.providerJobId,
      runId: scope.runId,
      updatedAt: new Date().toISOString(),
      userId: scope.userId,
    })
    const result
      = claim.executionMode === 'debug'
        ? {
            facts: { providerCostUsd: 0 },
            outputs: await debugOutputs(claim),
            providerJobId: null,
          }
        : await liveProviderResult(claim, scope)
    await checkpointBrowserJob(scope, claim.job.id, {
      facts: result.facts,
      ...(result.providerJobId ? { providerJobId: result.providerJobId } : {}),
    })
    if ((await getBrowserManifest(scope)).run.status === 'canceled')
      throw new DOMException('Run canceled', 'AbortError')
    await transferBrowserOutputs({
      ...scope,
      jobId: claim.job.id,
      outputs: result.outputs,
      providerJobId: result.providerJobId,
    })
    const completion = await completeBrowserJob(scope, claim.job.id, {
      facts: result.facts,
    })
    if (completion.state === 'processing')
      return 'processing' as const
    await clearBrowserJobJournal(scope.runId, claim.job.id)
    return 'settled' as const
  }
  catch (error) {
    if (scope.signal.aborted) {
      await writeBrowserRunJournal({
        executorId: scope.executorId,
        jobId: claim.job.id,
        nextEligibleAt: null,
        organizationId: scope.organizationId,
        outputIndex: null,
        phase: 'interrupted',
        providerJobId: claim.job.providerJobId,
        runId: scope.runId,
        updatedAt: new Date().toISOString(),
        userId: scope.userId,
      }).catch(() => undefined)
      return 'settled' as const
    }
    const candidate = error as { code?: string }
    const providerError
      = error instanceof GenerationProviderError ? error : null
    let failure
    try {
      failure = await failBrowserJob(scope, claim.job.id, {
        code: browserJobFailureCode(candidate.code),
        ...(providerError?.retryAfterMs
          ? { retryAfterMs: providerError.retryAfterMs }
          : {}),
        ...(providerError
          ? { safeToResubmit: providerError.safeToResubmit }
          : {}),
      })
    }
    catch (reportError) {
      await writeBrowserRunJournal({
        executorId: scope.executorId,
        jobId: claim.job.id,
        nextEligibleAt: null,
        organizationId: scope.organizationId,
        outputIndex: null,
        phase: 'executor-error',
        providerJobId: claim.job.providerJobId,
        runId: scope.runId,
        updatedAt: new Date().toISOString(),
        userId: scope.userId,
      }).catch(() => undefined)
      throw reportError
    }
    if ('state' in failure && failure.state === 'retrying') {
      await writeBrowserRunJournal({
        executorId: scope.executorId,
        jobId: claim.job.id,
        nextEligibleAt: failure.nextEligibleAt,
        organizationId: scope.organizationId,
        outputIndex: null,
        phase: 'interrupted',
        providerJobId: claim.job.providerJobId,
        runId: scope.runId,
        updatedAt: new Date().toISOString(),
        userId: scope.userId,
      })
    }
    else {
      await clearBrowserJobJournal(scope.runId, claim.job.id)
    }
    return 'settled' as const
  }
}
