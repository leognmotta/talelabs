/** Cache reconciliation after a dormant Element master-reference link commits. */

import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from '../assets/data/asset-query-keys'
import { invalidateElementCache } from '../elements/element-query-cache'
import { flowQueryKeys } from '../flows/data/query-keys/flow-query-keys'

/** Binds Element, Asset, and Flow-reference invalidation to one QueryClient. */
export function createElementLinkedCacheHandler(queryClient: QueryClient) {
  return async function elementLinked(
    organizationId: string,
    elementId: string,
    assetId: string,
  ) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: assetQueryKeys.detail(organizationId, assetId),
      }),
      queryClient.invalidateQueries({
        queryKey: assetQueryKeys.lists(organizationId),
      }),
      invalidateElementCache(queryClient, organizationId, { elementId }),
      queryClient.invalidateQueries({
        queryKey: flowQueryKeys.allReferences(organizationId),
      }),
    ])
  }
}
