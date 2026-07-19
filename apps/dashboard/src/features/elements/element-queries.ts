/** Element list and detail queries scoped to the active organization. */

import type { ElementKind, GetElementsQueryParams } from '@talelabs/sdk'

import { getElements, getElementsId } from '@talelabs/sdk'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { elementQueryKeys } from './element-query-keys'

/** Maximum Elements requested per page for the library and picker surfaces. */
export const ELEMENT_LIBRARY_PAGE_SIZE = 60

/**
 * Loads the Element library as cursor pages so every Element stays reachable
 * beyond the first page; list surfaces render a load-more affordance.
 */
export function useElementListInfiniteQuery(filters: {
  assetId?: string
  kind?: ElementKind
  search?: string
}) {
  const organizationId = useActiveOrganizationId()
  const params: GetElementsQueryParams = {
    ...(filters.assetId ? { assetId: filters.assetId } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    limit: ELEMENT_LIBRARY_PAGE_SIZE,
  }
  return useInfiniteQuery({
    queryKey: elementQueryKeys.list(organizationId!, {
      ...params,
      paged: true,
    }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      getElements(
        { params: { ...params, cursor: pageParam } },
        {
          headers: getOrganizationRequestHeaders(organizationId!),
          signal,
        },
      ),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
  })
}

/** Loads one Element with its ordered references. */
export function useElementDetailQuery(elementId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    enabled: Boolean(organizationId && elementId),
    queryFn: ({ signal }) =>
      getElementsId(
        { id: elementId! },
        {
          headers: getOrganizationRequestHeaders(organizationId!),
          signal,
        },
      ),
    queryKey: elementQueryKeys.detail(organizationId!, elementId ?? ''),
  })
}
