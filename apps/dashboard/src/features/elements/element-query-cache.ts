import type { QueryClient } from '@tanstack/react-query'

import { elementQueryKeys } from './element-query-keys'

interface InvalidateElementCacheOptions {
  elementId?: string
  includeKit?: boolean
}

/**
 * Invalidates Element data whose server response is derived from Asset links.
 * Omitting an Element ID invalidates the complete organization-scoped Element
 * cache, which is required when the affected relationships are not known.
 */
export function invalidateElementCache(
  queryClient: QueryClient,
  organizationId: string,
  options: InvalidateElementCacheOptions = {},
) {
  const { elementId, includeKit = true } = options

  if (!elementId && includeKit) {
    return queryClient.invalidateQueries({
      queryKey: elementQueryKeys.scope(organizationId),
    })
  }

  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: elementId
        ? elementQueryKeys.detail(organizationId, elementId)
        : elementQueryKeys.details(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: elementQueryKeys.lists(organizationId),
    }),
    ...(includeKit
      ? [queryClient.invalidateQueries({
          queryKey: elementId
            ? elementQueryKeys.kit(organizationId, elementId)
            : elementQueryKeys.kits(organizationId),
        })]
      : []),
  ]).then(() => undefined)
}
