import { db } from '@talelabs/db'
import { wait } from '@trigger.dev/sdk'

/** Uses a callback-completable wait token, with timeout returning to polling. */
export async function waitForGenerationProviderCallback(input: {
  allowPersistedCompletion: boolean
  callbackEnabled: boolean
  delayMs: number
  jobId: string
  organizationId: string
}) {
  if (!input.callbackEnabled) {
    await wait.for({ seconds: Math.ceil(input.delayMs / 1_000) })
    return false
  }

  const timeoutSeconds = Math.max(5, Math.ceil(input.delayMs / 1_000))
  const token = await wait.createToken({ timeout: `${timeoutSeconds}s` })
  const persisted = await db.updateTable('generationJobs')
    .set({ providerWaitTokenId: token.id })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.jobId)
    .where('status', '=', 'running')
    .returning(['providerCompletionStatus'])
    .executeTakeFirst()
  if (!persisted)
    throw new Error('generation_provider_wait_job_not_running')
  if (
    input.allowPersistedCompletion
    && persisted.providerCompletionStatus
  ) {
    await wait.completeToken(token.id, {
      status: persisted.providerCompletionStatus,
    })
  }
  try {
    const result = await wait.forToken<{ status: string }>(token)
    return result.ok
  }
  finally {
    await db.updateTable('generationJobs')
      .set({ providerWaitTokenId: null })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.jobId)
      .where('providerWaitTokenId', '=', token.id)
      .execute()
  }
}
