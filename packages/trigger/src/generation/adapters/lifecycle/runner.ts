import type {
  NormalizedGenerationOutput,
  NormalizedGenerationProviderFacts,
  NormalizedGenerationRequest,
  NormalizedGenerationSubmissionContext,
} from '@talelabs/flows'

import type { ResolvedGenerationProviderAdapter } from '../contracts.js'

import { GenerationProviderError } from '../errors.js'
import { GENERATION_PROVIDER_MAX_POLL_DURATION_MS } from '../execution-limits.js'
import { reconcileCompletedGenerationProviderFacts } from './fact-reconciliation.js'
import {
  boundedGenerationProviderPollDelay,
  mergeGenerationProviderFacts,
  validateLifecycleProviderOutputs,
} from './helpers.js'
import { prepareGenerationProviderSubmission } from './submission.js'

export interface GenerationProviderLifecycleResult {
  facts: NormalizedGenerationProviderFacts
  outputs: readonly NormalizedGenerationOutput[]
}

/** Owns one spend-safe submit/resume/poll lifecycle with durable waits injected. */
export async function runGenerationProviderLifecycle(input: {
  beforeSubmit?: () => Promise<void>
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

  let facts: NormalizedGenerationProviderFacts = {}
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
  while (Date.now() - submittedAt <= GENERATION_PROVIDER_MAX_POLL_DURATION_MS) {
    const providerCompletionWokeWait = await input.waitForPoll(
      boundedGenerationProviderPollDelay(pollAfterMs),
      allowPersistedCompletion,
    )
    if (providerCompletionWokeWait)
      allowPersistedCompletion = false
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
        code: completion.code === 'provider_rejected'
          ? 'provider_rejected'
          : 'provider_unavailable',
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
