import { db } from '@talelabs/db'

export async function markProviderSubmissionStarted(input: {
  jobId: string
  organizationId: string
}) {
  const claimed = await db.updateTable('generationJobs')
    .set({
      providerSettlementResolvedAt: null,
      providerSettlementStatus: 'pending',
      providerSubmittedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('status', '=', 'running')
    .where('providerSubmittedAt', 'is', null)
    .where('providerSettlementStatus', '=', 'not_required')
    .returning('id')
    .executeTakeFirst()
  if (!claimed)
    throw new Error('provider_submission_marker_conflict')
}

export async function persistProviderFacts(input: {
  facts: {
    providerCostUsd?: number
    providerGenerationId?: string
  }
  jobId: string
  organizationId: string
}) {
  const values = {
    ...(input.facts.providerCostUsd === undefined
      ? {}
      : { providerCostUsd: String(input.facts.providerCostUsd) }),
    ...(input.facts.providerGenerationId === undefined
      ? {}
      : { providerGenerationId: input.facts.providerGenerationId }),
  }
  if (!Object.keys(values).length)
    return
  await db.transaction().execute(async (trx) => {
    const job = await trx.updateTable('generationJobs')
      .set(values)
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.jobId)
      .where('status', '=', 'running')
      .returning('id')
      .executeTakeFirst()
    if (!job)
      return
    await trx.updateTable('generationProviderResults')
      .set(values)
      .where('organizationId', '=', input.organizationId)
      .where('jobId', '=', input.jobId)
      .execute()
  })
}

export async function persistProviderSubmission(input: {
  externalJobId: string
  facts: {
    providerCostUsd?: number
    providerGenerationId?: string
  }
  jobId: string
  organizationId: string
}) {
  const persisted = await db.updateTable('generationJobs')
    .set({
      providerJobId: input.externalJobId,
      ...(input.facts.providerCostUsd === undefined
        ? {}
        : { providerCostUsd: String(input.facts.providerCostUsd) }),
      ...(input.facts.providerGenerationId === undefined
        ? {}
        : { providerGenerationId: input.facts.providerGenerationId }),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('status', '=', 'running')
    .where('providerSubmittedAt', 'is not', null)
    .where(eb => eb.or([
      eb('providerJobId', 'is', null),
      eb('providerJobId', '=', input.externalJobId),
    ]))
    .returning('id')
    .executeTakeFirst()
  if (!persisted)
    throw new Error('provider_submission_persistence_conflict')
}
