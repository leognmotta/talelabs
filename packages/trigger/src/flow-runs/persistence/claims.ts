import type { FlowRunStatus } from '@talelabs/db'

import { db, sql } from '@talelabs/db'

const ACTIVE_DOMAIN_STATUSES: FlowRunStatus[] = ['pending', 'running']

/** Claims the one persisted Trigger parent without allowing ownership takeover. */
export async function claimFlowRunTriggerParent(input: {
  triggerDeploymentVersion?: string | null
  flowRunId: string
  organizationId: string
  triggerRunId: string
}) {
  let query = db.updateTable('flowRuns')
    .set(input.triggerDeploymentVersion
      ? {
          triggerDeploymentVersion: input.triggerDeploymentVersion,
          triggerRunId: input.triggerRunId,
        }
      : { triggerRunId: input.triggerRunId })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.flowRunId)
    .where('status', 'in', ACTIVE_DOMAIN_STATUSES)
    .where(eb => eb.or([
      eb('triggerRunId', 'is', null),
      eb('triggerRunId', '=', input.triggerRunId),
    ]))
  if (input.triggerDeploymentVersion) {
    query = query.where(eb => eb.or([
      eb('triggerDeploymentVersion', 'is', null),
      eb('triggerDeploymentVersion', '=', input.triggerDeploymentVersion!),
    ]))
  }
  const claimed = await query.returning('id').executeTakeFirst()
  return Boolean(claimed)
}

/** Fairly rotates pending durable outbox rows before Trigger dispatch. */
export async function claimUndispatchedFlowRuns(input: {
  limit?: number
  organizationId?: string
}) {
  const organizationClause = input.organizationId
    ? sql`and run."organizationId" = ${input.organizationId}`
    : sql``
  const result = await sql<{ id: string, organizationId: string }>`
    with candidates as (
      select run."organizationId", run."id"
      from "flowRuns" as run
      where run."status" = 'pending'
        and run."triggerRunId" is null
        ${organizationClause}
      order by
        run."lastReconciledAt" asc nulls first,
        run."createdAt",
        run."id"
      for update of run skip locked
      limit ${input.limit ?? 100}
    )
    update "flowRuns" as run
    set "lastReconciledAt" = now()
    from candidates
    where run."organizationId" = candidates."organizationId"
      and run."id" = candidates."id"
    returning run."id", run."organizationId"
  `.execute(db)
  return result.rows
}
