/** Element cache invalidation shared by Element and Asset mutations. */

import type { QueryClient } from '@tanstack/react-query'

import { flowQueryKeys } from '../flows/data/query-keys/flow-query-keys'
import { elementQueryKeys } from './element-query-keys'

/**
 * Invalidates every read that renders Element state after any mutation that
 * can change an Element's references or cover: the Element library and
 * detail queries, and the Flow canvas reference hydration that Element nodes
 * are drawn from — otherwise open canvases keep stale reference lists until
 * a manual refresh.
 */
export function invalidateElementCache(
  queryClient: QueryClient,
  organizationId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: elementQueryKeys.all(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: flowQueryKeys.allReferences(organizationId),
    }),
  ])
}
