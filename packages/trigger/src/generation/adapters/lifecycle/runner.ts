/** Provider-neutral immediate and asynchronous execution lifecycle orchestration. */

import type {
  NormalizedGenerationOutput,
  NormalizedGenerationProviderFacts,
  NormalizedGenerationRequest,
  NormalizedGenerationSubmissionContext,
} from '@talelabs/flows'

import type { ResolvedGenerationProviderAdapter } from '../contracts.js'
import type { GenerationProviderErrorCode } from '../errors.js'

import { GenerationProviderError } from '../errors.js'
import { GENERATION_PROVIDER_MAX_POLL_DURATION_MS } from '../execution-limits.js'
import { reconcileCompletedGenerationProviderFacts } from './fact-reconciliation.js'
import {
  boundedGenerationProviderPollDelay,
  mergeGenerationProviderFacts,
  validateLifecycleProviderOutputs,
} from './helpers.js'
import { prepareGenerationProviderSubmission } from './submission.js'

const GENERATION_PROVIDER_ERROR_CODES = new Set<GenerationProviderErrorCode>([
  'provider_authentication',
  'provider_insufficient_balance',
  'provider_rate_limited',
  'provider_rejected',
  'provider_response_invalid',
  'provider_submission_uncertain',
  'provider_timeout',
  'provider_unavailable',
])

function completionFailureCode(code: string): GenerationProviderErrorCode {
  return GENERATION_PROVIDER_ERROR_CODES.has(code as GenerationProviderErrorCode)
    ? code as GenerationProviderErrorCode
    : 'provider_unavailable'
}

/** Normalized completion returned after durable provider reconciliation. */
export interface GenerationProviderLifecycleResult {
  /** Safe provider accounting and provenance facts accumulated across attempts. */
  facts: NormalizedGenerationProviderFacts
  /** Ordered provider outputs validated against the immutable request contract. */
  outputs: readonly NormalizedGenerationOutput[]
}

/** Owns one spend-safe submit/resume/poll lifecycle with durable waits injected. */
export async function runGenerationProviderLifecycle(input: {
  beforeSubmit?: () => Promise<void>
  isCancellationRequested?: () => Promise<boolean>
  onCompleted?: (
    result: GenerationProviderLifecycleResult,
  ) => Promise<GenerationProviderLifecycleResult>
  onFacts?: (facts: NormalizedGenerationProviderFacts) => Promise<void>
  onSubmitted?: (submission: {
    externalJobId: string
    facts: NormalizedGenerationProviderFacts
  }) => Promise<void>
  providerSubmittedAt?: Date | null
  request: NormalizedGenerationRequest
  resumeCompleted?: () => Promise<GenerationProviderLifecycleResult | null>
  resumeFacts?: NormalizedGenerationProviderFacts
  resolvedAdapter: ResolvedGenerationProviderAdapter
  resumeExternalJobId?: null | string
  submissionContext?: NormalizedGenerationSubmissionContext
  waitForPoll?: (
    delayMs: number,
    allowPersistedCompletion: boolean,
  ) => Promise<boolean>
}): Promise<GenerationProviderLifecycleResult> {
  const { adapter, route } = input.resolvedAdapter
  if (
    input.request.modelContractVersion !== route.modelContractVersion
    || input.request.operationId !== route.operationId
    || input.request.productModelId !== route.productModelId
  ) {
    throw new Error('generation_provider_request_route_mismatch')
  }

  const resumed = await input.resumeCompleted?.()
  if (resumed) {
    return reconcileCompletedGenerationProviderFacts({
      onFacts: input.onFacts,
      resolvedAdapter: input.resolvedAdapter,
      result: resumed,
    })
  }

  let facts: NormalizedGenerationProviderFacts = input.resumeFacts
    ? { ...input.resumeFacts }
    : {}
  if (adapter.lifecycle.submission === 'immediate') {
    if (input.providerSubmittedAt) {
      throw new GenerationProviderError({
        code: 'provider_submission_uncertain',
        retryable: false,
      })
    }
    const submit = await prepareGenerationProviderSubmission({
      request: input.request,
      resolvedAdapter: input.resolvedAdapter,
      submissionContext: input.submissionContext,
    })
    await input.beforeSubmit?.()
    const submission = await submit()
    if (submission.status !== 'completed')
      throw new Error('generation_provider_lifecycle_mismatch')
    facts = mergeGenerationProviderFacts(facts, submission.facts)
    const completed = {
      facts,
      outputs: validateLifecycleProviderOutputs({
        outputs: submission.outputs,
        request: input.request,
        resolvedAdapter: input.resolvedAdapter,
      }),
    }
    const checkpointed = input.onCompleted
      ? await input.onCompleted(completed)
      : completed
    return reconcileCompletedGenerationProviderFacts({
      onFacts: input.onFacts,
      resolvedAdapter: input.resolvedAdapter,
      result: checkpointed,
    })
  }

  if (!('poll' in adapter) || !adapter.poll)
    throw new Error('generation_provider_poll_unavailable')
  if (!input.waitForPoll)
    throw new Error('generation_provider_durable_wait_unavailable')

  let externalJobId = input.resumeExternalJobId ?? null
  let pollAfterMs = 30_000
  if (!externalJobId) {
    if (input.providerSubmittedAt) {
      throw new GenerationProviderError({
        code: 'provider_submission_uncertain',
        retryable: false,
      })
    }
    const submit = await prepareGenerationProviderSubmission({
      request: input.request,
      resolvedAdapter: input.resolvedAdapter,
      submissionContext: input.submissionContext,
    })
    await input.beforeSubmit?.()
    const submission = await submit()
    if (submission.status !== 'submitted')
      throw new Error('generation_provider_lifecycle_mismatch')
    externalJobId = submission.externalJobId
    pollAfterMs = boundedGenerationProviderPollDelay(submission.pollAfterMs)
    facts = mergeGenerationProviderFacts(facts, submission.facts)
    await input.onSubmitted?.({ externalJobId, facts })
  }

  const submittedAt = input.providerSubmittedAt?.getTime() ?? Date.now()
  let allowPersistedCompletion = true
  let cancellationRequestFinished = false
  const requestCancellationIfNeeded = async () => {
    if (
      cancellationRequestFinished
      || !input.isCancellationRequested
      || !await input.isCancellationRequested()
    ) {
      return
    }
    if (adapter.lifecycle.cancellation === 'unsupported' || !adapter.cancel) {
      cancellationRequestFinished = true
      return
    }
    try {
      const outcome = await adapter.cancel(externalJobId)
      cancellationRequestFinished = outcome.accepted || outcome.final
    }
    catch {
      // Cancellation is best-effort; polling remains the settlement authority.
    }
  }
  while (Date.now() - submittedAt <= GENERATION_PROVIDER_MAX_POLL_DURATION_MS) {
    await requestCancellationIfNeeded()
    const providerCompletionWokeWait = await input.waitForPoll(
      boundedGenerationProviderPollDelay(pollAfterMs),
      allowPersistedCompletion,
    )
    if (providerCompletionWokeWait)
      allowPersistedCompletion = false
    await requestCancellationIfNeeded()
    const completion = await adapter.poll(externalJobId)
    facts = mergeGenerationProviderFacts(facts, completion.facts)
    if (completion.status === 'pending') {
      await input.onFacts?.(facts)
      pollAfterMs = boundedGenerationProviderPollDelay(completion.pollAfterMs)
      continue
    }
    if (completion.status === 'failed') {
      await input.onFacts?.(facts)
      throw new GenerationProviderError({
        code: completionFailureCode(completion.code),
        publicMessage: completion.message,
        retryable: completion.retryable,
      })
    }
    const completed = {
      facts,
      outputs: validateLifecycleProviderOutputs({
        outputs: completion.outputs,
        request: input.request,
        resolvedAdapter: input.resolvedAdapter,
      }),
    }
    const checkpointed = input.onCompleted
      ? await input.onCompleted(completed)
      : completed
    return reconcileCompletedGenerationProviderFacts({
      onFacts: input.onFacts,
      resolvedAdapter: input.resolvedAdapter,
      result: checkpointed,
    })
  }
  throw new GenerationProviderError({
    code: 'provider_timeout',
    retryable: false,
  })
}
