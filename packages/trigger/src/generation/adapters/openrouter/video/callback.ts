import type { GenerationProviderCompletionStatus } from '@talelabs/db'

import { db } from '@talelabs/db'
import { wait } from '@trigger.dev/sdk'

/** Persists a verified terminal event before waking the current durable wait. */
export async function recordOpenRouterVideoCompletion(input: {
  eventId: string
  externalJobId: string
  generationJobId: string
  organizationId: string
  status: GenerationProviderCompletionStatus
}) {
  const job = await db.transaction().execute(async (trx) => {
    const updated = await trx.updateTable('generationJobs')
      .set({
        providerCompletionEventId: input.eventId,
        providerCompletionReceivedAt: new Date(),
        providerCompletionStatus: input.status,
        providerJobId: input.externalJobId,
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .where('provider', '=', 'openrouter')
      .where('providerEndpoint', '=', '/api/v1/videos')
      .where('providerCompletionEventId', 'is', null)
      .where(eb => eb.or([
        eb('providerJobId', 'is', null),
        eb('providerJobId', '=', input.externalJobId),
      ]))
      .returning(['providerWaitTokenId'])
      .executeTakeFirst()
    if (updated)
      return updated
    const existing = await trx.selectFrom('generationJobs')
      .select([
        'providerCompletionEventId',
        'providerJobId',
        'providerWaitTokenId',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.generationJobId)
      .executeTakeFirst()
    if (
      existing?.providerCompletionEventId === input.eventId
      && existing.providerJobId === input.externalJobId
    ) {
      return { ...existing, duplicate: true as const }
    }
    return null
  })
  if (!job)
    return false
  if (job.providerWaitTokenId && !('duplicate' in job)) {
    await wait.completeToken(job.providerWaitTokenId, { status: input.status })
  }
  return true
}
