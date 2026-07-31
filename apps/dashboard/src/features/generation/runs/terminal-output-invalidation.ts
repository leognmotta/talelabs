/**
 * Shared terminal-run cache refresh for canonical generated Asset outputs.
 *
 * Flow and Create observers may see the same completion through realtime and
 * query recovery, so each browser QueryClient refreshes one run only once.
 */

import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from '../../assets/data/asset-query-keys'
import { invalidateBillingActivityQueries } from '../../billing/billing-queries'
import { projectQueryKeys } from '../../projects/project-query-keys'

const MAX_TRACKED_TERMINAL_RUNS = 1_000
const refreshedRunsByClient = new WeakMap<QueryClient, Set<string>>()

/** Refreshes output-dependent Asset, folder, and Project state once per run. */
export async function invalidateTerminalOutputQueries(input: {
  organizationId: string
  queryClient: QueryClient
  runId: string
}) {
  const refreshKey = `${input.organizationId}:${input.runId}`
  const refreshedRuns = refreshedRunsByClient.get(input.queryClient) ?? new Set()
  refreshedRunsByClient.set(input.queryClient, refreshedRuns)
  if (refreshedRuns.has(refreshKey))
    return

  if (refreshedRuns.size >= MAX_TRACKED_TERMINAL_RUNS) {
    const oldest = refreshedRuns.values().next().value
    if (oldest)
      refreshedRuns.delete(oldest)
  }
  refreshedRuns.add(refreshKey)

  await Promise.allSettled([
    input.queryClient.invalidateQueries({
      queryKey: assetQueryKeys.lists(input.organizationId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: assetQueryKeys.folderScope(input.organizationId),
    }),
    input.queryClient.invalidateQueries({
      queryKey: projectQueryKeys.scope(input.organizationId),
    }),
    invalidateBillingActivityQueries(
      input.queryClient,
      input.organizationId,
    ),
  ])
}
