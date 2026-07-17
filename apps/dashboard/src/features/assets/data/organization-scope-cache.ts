/** Organization cache-presence checks shared by optimistic Asset mutations. */

import type { QueryClient } from '@tanstack/react-query'

import { assetQueryKeys } from './asset-query-keys'

/** Reports whether this client has initialized any cache for the organization. */
export function hasOrganizationScopeCache(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.getQueryCache().findAll({
    queryKey: assetQueryKeys.scope(organizationId),
  }).length > 0
}
