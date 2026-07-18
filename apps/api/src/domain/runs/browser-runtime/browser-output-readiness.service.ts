/** Durable readiness and terminal settlement for browser-generated outputs. */

import type { Database, Transaction } from '@talelabs/db'

import { readFlowRunJobRequestPayload } from '@talelabs/flows'
import { completeGenerationJob } from '@talelabs/trigger'

interface BrowserCompletableJob {
  browserReportedProviderCostUsd: null | string
  browserReportedProviderGenerationId: null | string
  creditCost: null | number
  flowRunId: string
  id: string
  itemKey: string
  mediaType: 'audio' | 'image' | 'text' | 'video'
  nodeId: string
  organizationId: string
  provider: string
  providerCostUsd: null | string
  providerSubmittedAt: Date | null
  requestHash: string
  requestPayload: unknown
}

/** Reads whether every planned output is persisted, processing, ready, or failed. */
export async function readBrowserJobOutputReadiness(
  job: BrowserCompletableJob,
  trx: Transaction<Database>,
) {
  const request = readFlowRunJobRequestPayload({
    requestHash: job.requestHash,
    requestPayload: job.requestPayload,
  })
  if (job.mediaType === 'text') {
    const output = await trx
      .selectFrom('generationJobTextOutputs')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', job.organizationId)
      .where('jobId', '=', job.id)
      .executeTakeFirst()
    return Number(output?.count ?? 0) === request.outputCount
      ? ('ready' as const)
      : ('incomplete' as const)
  }

  const outputs = await trx
    .selectFrom('assets')
    .select(['deletedAt', 'processingState', 'purgedAt', 'purgeRequestedAt'])
    .where('organizationId', '=', job.organizationId)
    .where('generationJobId', '=', job.id)
    .execute()
  if (outputs.length !== request.outputCount)
    return 'incomplete' as const
  if (
    outputs.some(
      output =>
        output.processingState === 'failed'
        || output.deletedAt !== null
        || output.purgeRequestedAt !== null
        || output.purgedAt !== null,
    )
  ) {
    return 'failed' as const
  }
  return outputs.every(output => output.processingState === 'ready')
    ? ('ready' as const)
    : ('processing' as const)
}

/** Applies the one authoritative successful browser-job settlement transition. */
export async function settleReadyBrowserJob(input: {
  executionMode: 'debug' | 'live'
  facts?: { providerCostUsd?: number, providerGenerationId?: string }
  job: BrowserCompletableJob
  trx: Transaction<Database>
}) {
  const providerWasSubmitted = input.job.providerSubmittedAt !== null
  await input.trx
    .updateTable('generationJobs')
    .set({
      browserReportedProviderCostUsd:
        input.facts?.providerCostUsd
        ?? input.job.browserReportedProviderCostUsd,
      browserReportedProviderGenerationId:
        input.facts?.providerGenerationId
        ?? input.job.browserReportedProviderGenerationId,
      creditCost: input.executionMode === 'debug' ? 0 : input.job.creditCost,
      providerCostUsd:
        input.executionMode === 'debug' ? '0' : input.job.providerCostUsd,
      providerSettlementResolvedAt: providerWasSubmitted ? new Date() : null,
      providerSettlementStatus: providerWasSubmitted
        ? 'unknown'
        : 'not_required',
    })
    .where('organizationId', '=', input.job.organizationId)
    .where('id', '=', input.job.id)
    .execute()
  return completeGenerationJob(
    {
      creditCost: input.executionMode === 'debug' ? 0 : input.job.creditCost,
      job: input.job,
      organizationId: input.job.organizationId,
    },
    input.trx,
  )
}
