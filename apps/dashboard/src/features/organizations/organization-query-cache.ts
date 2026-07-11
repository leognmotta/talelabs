import type { QueryClient } from '@tanstack/react-query'

import { organizationQueryKeys } from './organization-query-keys'

export async function removeOrganizationProductQueries(
  queryClient: QueryClient,
  organizationId: null | string,
) {
  if (!organizationId)
    return

  const queryKey = organizationQueryKeys.scope(organizationId)
  await queryClient.cancelQueries({ queryKey })
  queryClient.removeQueries({ queryKey })
}

export function invalidateOrganizationProductQueries(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.invalidateQueries({
    queryKey: organizationQueryKeys.scope(organizationId),
  })
}
