import type { NormalizedGenerationOutput } from '@talelabs/flows'
import type { FinalizableGenerationJob } from './finalizer.js'

import { db } from '@talelabs/db'

async function persistTextOutputIfJobRunning(input: {
  job: FinalizableGenerationJob
  outputIndex: number
  text: string
}) {
  return db.transaction().execute(async (trx) => {
    const run = await trx.selectFrom('flowRuns')
      .select('status')
      .where('organizationId', '=', input.job.organizationId)
      .where('id', '=', input.job.flowRunId)
      .forUpdate()
      .executeTakeFirst()
    if (run?.status === 'canceled')
      return false
    const job = await trx.updateTable('generationJobs')
      .set({ status: 'running' })
      .where('organizationId', '=', input.job.organizationId)
      .where('id', '=', input.job.id)
      .where('flowRunId', '=', input.job.flowRunId)
      .where('status', '=', 'running')
      .returning('id')
      .executeTakeFirst()
    if (!job)
      return false
    await trx.insertInto('generationJobTextOutputs')
      .values({
        jobId: input.job.id,
        organizationId: input.job.organizationId,
        outputIndex: input.outputIndex,
        text: input.text,
      })
      .onConflict(conflict => conflict.columns(['jobId', 'outputIndex']).doNothing())
      .execute()
    return true
  })
}

export async function finalizeTextOutput(
  job: FinalizableGenerationJob,
  output: NormalizedGenerationOutput,
) {
  if (output.payload.delivery !== 'text')
    throw new Error('generation_text_delivery_invalid')
  return persistTextOutputIfJobRunning({
    job,
    outputIndex: output.outputIndex,
    text: output.payload.text,
  })
}
