/** Mounts one subscription per active run while preserving stable run identity. */

import { useActiveFlowRunsQuery } from './active-flow-runs.query'
import { FlowRunRealtimeTokenSubscription } from './flow-run-realtime-token-subscription'

/** Recovers and mounts subscriptions for every active run in the organization. */
export function FlowRunRealtimeSubscriptions({
  organizationId,
}: {
  organizationId: string
}) {
  const activeRunsQuery = useActiveFlowRunsQuery()
  const activeRunIds = activeRunsQuery.data ?? []

  return (
    <>
      {activeRunIds.map(runId => (
        <FlowRunRealtimeTokenSubscription
          key={runId}
          organizationId={organizationId}
          runId={runId}
        />
      ))}
    </>
  )
}
