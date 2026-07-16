import { FlowRunRealtimeTokenSubscription } from './flow-run-realtime-token-subscription'
import { useActiveFlowRunsQuery } from './flow.queries'

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
