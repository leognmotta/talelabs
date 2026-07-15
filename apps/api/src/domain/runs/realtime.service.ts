import { db } from '@talelabs/db'
import { auth as triggerAuth } from '@talelabs/trigger'

import { HttpError, TenantResourceNotFoundError } from '../../middleware/error.js'

export async function createRunRealtimeToken(input: {
  organizationId: string
  runId: string
}) {
  const run = await db.selectFrom('flowRuns')
    .select(['id', 'triggerRunId'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.runId)
    .executeTakeFirst()
  if (!run)
    throw new TenantResourceNotFoundError()
  if (!run.triggerRunId) {
    throw new HttpError(
      409,
      'run_not_dispatched',
      'Realtime is available after the run is dispatched.',
    )
  }
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  const token = await triggerAuth.createPublicToken({
    expirationTime: '15m',
    scopes: { read: { runs: [run.triggerRunId] } },
  })
  return {
    expiresAt: expiresAt.toISOString(),
    publicAccessToken: token,
    triggerRunId: run.triggerRunId,
  }
}
