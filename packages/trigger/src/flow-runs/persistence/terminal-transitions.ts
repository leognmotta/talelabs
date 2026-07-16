import type { SafeRunFailure } from '../../shared/failures/run-failure.js'

import { db, sql } from '@talelabs/db'

import { cleanupUncommittedGeneratedOutputObjectsForRun } from '../../assets/outputs/generated-storage.js'
import { aggregateFlowRunState } from './state.js'

export async function failActiveFlowRunJobs(input: {
  failure: SafeRunFailure
  flowRunId: string
  organizationId: string
}) {
  const now = new Date()
  await db.updateTable('generationJobs')
    .set({
      completedAt: now,
      errorCode: input.failure.code,
      errorMessage: input.failure.message,
      providerSettlementResolvedAt: sql`case
        when "providerSettlementStatus" = 'pending' then ${now}
        else "providerSettlementResolvedAt"
      end`,
      providerSettlementStatus: sql`case
        when "providerSettlementStatus" = 'pending' then 'unknown'
        else "providerSettlementStatus"
      end`,
      status: 'failed',
    })
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where('status', 'in', ['pending', 'running'])
    .execute()
  await cleanupUncommittedGeneratedOutputObjectsForRun({
    flowRunId: input.flowRunId,
    organizationId: input.organizationId,
  })
  return aggregateFlowRunState(input.organizationId, input.flowRunId)
}

export async function acknowledgeCanceledRun(input: {
  flowRunId: string
  organizationId: string
  triggerRunId: string
}) {
  await cleanupUncommittedGeneratedOutputObjectsForRun({
    flowRunId: input.flowRunId,
    organizationId: input.organizationId,
  })
  const result = await db.updateTable('flowRuns')
    .set({
      cancellationReconciledAt: new Date(),
      providerCostUsd: sql`(
        select case
          when count(*) filter (
            where job."provider" <> 'talelabs-mock'
              and job."providerCostUsd" is null
          ) > 0 then null
          else coalesce(sum(job."providerCostUsd"), 0)
        end
        from "generationJobs" as job
        where job."organizationId" = "flowRuns"."organizationId"
          and job."flowRunId" = "flowRuns"."id"
      )`,
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.flowRunId)
    .where('status', '=', 'canceled')
    .where('triggerRunId', '=', input.triggerRunId)
    .where('cancellationReconciledAt', 'is', null)
    .where(eb => eb.not(eb.exists(
      eb.selectFrom('generationJobs')
        .select('id')
        .whereRef('generationJobs.organizationId', '=', 'flowRuns.organizationId')
        .whereRef('generationJobs.flowRunId', '=', 'flowRuns.id')
        .where(eb => eb.or([
          eb('generationJobs.status', 'in', ['pending', 'running']),
          eb('generationJobs.providerSettlementStatus', '=', 'pending'),
        ])),
    )))
    .executeTakeFirst()
  return Number(result.numUpdatedRows) > 0
}

/** Resolves bounded settlement ownership after the Trigger parent is terminal. */
export async function retireCanceledRunJobs(input: {
  flowRunId: string
  organizationId: string
}) {
  const now = new Date()
  await db.transaction().execute(async (trx) => {
    await trx.updateTable('generationJobs')
      .set({
        completedAt: now,
        providerSettlementResolvedAt: sql`case
          when "providerSettlementStatus" = 'pending' then ${now}
          else "providerSettlementResolvedAt"
        end`,
        providerSettlementStatus: sql`case
          when "providerSettlementStatus" = 'pending' then 'unknown'
          else "providerSettlementStatus"
        end`,
        status: 'canceled',
      })
      .where('organizationId', '=', input.organizationId)
      .where('flowRunId', '=', input.flowRunId)
      .where('status', 'in', ['pending', 'running'])
      .execute()
    await trx.updateTable('generationProviderOutputs')
      .set({ status: 'discarded', updatedAt: now })
      .where('organizationId', '=', input.organizationId)
      .where('jobId', 'in', eb => eb.selectFrom('generationJobs')
        .select('id')
        .where('organizationId', '=', input.organizationId)
        .where('flowRunId', '=', input.flowRunId)
        .where('providerSettlementStatus', '=', 'settled'))
      .where('status', 'in', ['staging', 'ready'])
      .execute()
  })
}
