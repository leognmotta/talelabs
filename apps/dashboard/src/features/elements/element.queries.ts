import type {
  CreateElementRequest,
  Element,
  ElementAssetLink,
  ElementAssetListResponse,
  ElementDetail,
  ElementListResponse,
  ElementType,
  GetElementsQueryParams,
  UpdateElementRequest,
} from '@talelabs/sdk'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import {
  deleteElementsId,
  deleteElementsIdAssetsAssetid,
  getElements,
  getElementsId,
  getElementsIdAssets,
  getElementsIdUsage,
  patchElementsId,
  patchElementsIdAssetsAssetid,
  postElements,
  postElementsIdAssets,
} from '@talelabs/sdk'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import {
  ASSET_PROCESSING_REFRESH_INTERVAL_MS,
  assetNeedsProcessingRefresh,
} from '../assets/asset-query-timing'
import { flowQueryKeys } from '../flows/flow-query-keys'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { elementQueryKeys } from './element-query-keys'

const ELEMENT_PAGE_SIZE = 40
function patchElementEverywhere(
  queryClient: QueryClient,
  organizationId: string,
  elementId: string,
  patch: Partial<Element>,
) {
  queryClient.setQueryData<ElementDetail>(
    elementQueryKeys.detail(organizationId, elementId),
    current => current ? { ...current, ...patch } : current,
  )
  queryClient.setQueriesData<InfiniteData<ElementListResponse>>(
    { queryKey: elementQueryKeys.lists(organizationId) },
    current => current
      ? {
          ...current,
          pages: current.pages.map(page => ({
            ...page,
            data: page.data.map(element =>
              element.id === elementId ? { ...element, ...patch } : element),
          })),
        }
      : current,
  )
}

function removeElementEverywhere(
  queryClient: QueryClient,
  organizationId: string,
  elementId: string,
) {
  queryClient.setQueriesData<InfiniteData<ElementListResponse>>(
    { queryKey: elementQueryKeys.lists(organizationId) },
    current => current
      ? {
          ...current,
          pages: current.pages.map(page => ({
            ...page,
            data: page.data.filter(element => element.id !== elementId),
          })),
        }
      : current,
  )
}

function updateKitCache(
  queryClient: QueryClient,
  organizationId: string,
  elementId: string,
  update: (links: ElementAssetLink[]) => ElementAssetLink[],
) {
  queryClient.setQueryData<ElementAssetListResponse>(
    elementQueryKeys.kit(organizationId, elementId),
    current => current ? { ...current, data: update(current.data) } : current,
  )
}

function sortKit(links: ElementAssetLink[]) {
  return links.toSorted((left, right) =>
    left.role.localeCompare(right.role)
    || left.sortOrder - right.sortOrder
    || left.assetId.localeCompare(right.assetId))
}

function hasOrganizationScopeCache(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.getQueryCache().findAll({
    queryKey: elementQueryKeys.scope(organizationId),
  }).length > 0
}

export function useElementListQuery(input: {
  search: string
  type?: ElementType
}) {
  const organizationId = useActiveOrganizationId()
  const params: GetElementsQueryParams = {
    limit: ELEMENT_PAGE_SIZE,
    search: input.search || undefined,
    type: input.type,
  }

  return useInfiniteQuery({
    queryKey: elementQueryKeys.list(organizationId, params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getElements(
      { params: { ...params, cursor: pageParam } },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === organizationId ? previousData : undefined,
  })
}

export function useElementDetailQuery(elementId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: elementQueryKeys.detail(organizationId, elementId),
    queryFn: ({ signal }) => getElementsId(
      { id: elementId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: Boolean(organizationId && elementId),
  })
}

export function useElementKitQuery(elementId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: elementQueryKeys.kit(organizationId, elementId),
    queryFn: ({ signal }) => getElementsIdAssets(
      { id: elementId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: Boolean(organizationId && elementId),
    refetchInterval: query => query.state.data?.data.some(link =>
      assetNeedsProcessingRefresh(link.asset))
      ? ASSET_PROCESSING_REFRESH_INTERVAL_MS
      : false,
    refetchOnWindowFocus: true,
  })
}

export function useElementUsageQuery(elementId: null | string, enabled = true) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: elementQueryKeys.usage(organizationId, elementId),
    queryFn: ({ signal }) => getElementsIdUsage(
      { id: elementId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: enabled && Boolean(organizationId && elementId),
  })
}

export function useElementMutations() {
  const queryClient = useQueryClient()

  return {
    create: useMutation({
      mutationFn: ({ data, organizationId }: {
        data: CreateElementRequest
        organizationId: string
      }) => postElements(
        { data },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onSuccess: (element, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        queryClient.setQueryData(
          elementQueryKeys.detail(organizationId, element.id),
          { ...element, assetCounts: {} },
        )
      },
      onSettled: (_data, _error, { organizationId }) => {
        void queryClient.invalidateQueries({
          queryKey: elementQueryKeys.lists(organizationId),
        })
      },
    }),
    update: useMutation({
      mutationFn: ({ id, data, organizationId }: {
        data: UpdateElementRequest
        id: string
        organizationId: string
      }) => patchElementsId(
        { id, data },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async ({ id, data, organizationId }) => {
        await queryClient.cancelQueries({
          queryKey: elementQueryKeys.scope(organizationId),
        })
        const detail = queryClient.getQueryData<ElementDetail>(
          elementQueryKeys.detail(organizationId, id),
        )
        const lists = queryClient.getQueriesData<InfiniteData<ElementListResponse>>({
          queryKey: elementQueryKeys.lists(organizationId),
        })
        patchElementEverywhere(
          queryClient,
          organizationId,
          id,
          data as Partial<Element>,
        )
        return { detail, lists, organizationId }
      },
      onError: (_error, { id }, context) => {
        if (!context || !hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          return
        }
        queryClient.setQueryData(
          elementQueryKeys.detail(context.organizationId, id),
          context.detail,
        )
        for (const [key, value] of context.lists)
          queryClient.setQueryData(key, value)
      },
      onSuccess: (element, { organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        patchElementEverywhere(
          queryClient,
          organizationId,
          element.id,
          element,
        )
      },
      onSettled: (_data, _error, { id, organizationId }) => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.detail(organizationId, id) }),
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.lists(organizationId) }),
          queryClient.invalidateQueries({ queryKey: flowQueryKeys.allReferences(organizationId) }),
        ])
      },
    }),
    remove: useMutation({
      mutationFn: ({ id, organizationId }: {
        id: string
        organizationId: string
      }) => deleteElementsId(
        { id },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async ({ id, organizationId }) => {
        await queryClient.cancelQueries({
          queryKey: elementQueryKeys.scope(organizationId),
        })
        const lists = queryClient.getQueriesData<InfiniteData<ElementListResponse>>({
          queryKey: elementQueryKeys.lists(organizationId),
        })
        removeElementEverywhere(queryClient, organizationId, id)
        return { lists, organizationId }
      },
      onError: (_error, _id, context) => {
        if (!context || !hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          return
        }
        for (const [key, value] of context?.lists ?? [])
          queryClient.setQueryData(key, value)
      },
      onSettled: (_data, _error, { id, organizationId }) => {
        queryClient.removeQueries({ queryKey: elementQueryKeys.detail(organizationId, id) })
        queryClient.removeQueries({ queryKey: elementQueryKeys.kit(organizationId, id) })
        queryClient.removeQueries({ queryKey: elementQueryKeys.usage(organizationId, id) })
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.lists(organizationId) }),
          queryClient.invalidateQueries({ queryKey: flowQueryKeys.allReferences(organizationId) }),
        ])
      },
    }),
    attachAsset: useMutation({
      mutationFn: ({ elementId, organizationId, ...data }: {
        assetId: string
        elementId: string
        isPrimary?: boolean
        organizationId: string
        role: string
        sortOrder?: number
      }) => postElementsIdAssets(
        { id: elementId, data },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onSuccess: (link, { elementId, organizationId }) => {
        if (!hasOrganizationScopeCache(queryClient, organizationId))
          return
        updateKitCache(queryClient, organizationId, elementId, links =>
          sortKit([...links.filter(item => !(item.assetId === link.assetId && item.role === link.role)), link]))
      },
      onSettled: (_data, _error, { elementId, organizationId }) => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.kit(organizationId, elementId) }),
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.detail(organizationId, elementId) }),
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.lists(organizationId) }),
          queryClient.invalidateQueries({ queryKey: flowQueryKeys.allReferences(organizationId) }),
        ])
      },
    }),
    updateAsset: useMutation({
      mutationFn: ({ assetId, elementId, organizationId, ...data }: {
        assetId: string
        elementId: string
        isPrimary?: boolean
        organizationId: string
        role: string
        sortOrder?: number
      }) => patchElementsIdAssetsAssetid(
        { assetId, id: elementId, data },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async (variables) => {
        const key = elementQueryKeys.kit(
          variables.organizationId,
          variables.elementId,
        )
        await queryClient.cancelQueries({ queryKey: key })
        const previous = queryClient.getQueryData<ElementAssetListResponse>(key)
        updateKitCache(
          queryClient,
          variables.organizationId,
          variables.elementId,
          (links) => {
            const roleLinks = links
              .filter(link => link.role === variables.role)
              .toSorted((left, right) => left.sortOrder - right.sortOrder)
            const currentIndex = roleLinks.findIndex(link => link.assetId === variables.assetId)
            if (currentIndex >= 0 && variables.sortOrder !== undefined) {
              const [moved] = roleLinks.splice(currentIndex, 1)
              roleLinks.splice(Math.min(variables.sortOrder, roleLinks.length), 0, moved!)
            }
            const orders = new Map(roleLinks.map((link, index) => [link.assetId, index]))
            return sortKit(links.map(link => link.role === variables.role
              ? {
                  ...link,
                  isPrimary: variables.isPrimary === true
                    ? link.assetId === variables.assetId
                    : link.assetId === variables.assetId && variables.isPrimary === false
                      ? false
                      : link.isPrimary,
                  sortOrder: orders.get(link.assetId) ?? link.sortOrder,
                }
              : link))
          },
        )
        return {
          key,
          organizationId: variables.organizationId,
          previous,
        }
      },
      onError: (_error, _variables, context) => {
        if (!context || !hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          return
        }
        queryClient.setQueryData(context?.key ?? [], context?.previous)
      },
      onSuccess: (link, variables) => {
        if (!hasOrganizationScopeCache(
          queryClient,
          variables.organizationId,
        )) {
          return
        }
        updateKitCache(
          queryClient,
          variables.organizationId,
          variables.elementId,
          links => sortKit(links.map(item =>
            item.assetId === link.assetId && item.role === link.role
              ? link
              : item)),
        )
      },
      onSettled: (_data, _error, { elementId, organizationId }) => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.kit(organizationId, elementId) }),
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.detail(organizationId, elementId) }),
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.lists(organizationId) }),
          queryClient.invalidateQueries({ queryKey: flowQueryKeys.allReferences(organizationId) }),
        ])
      },
    }),
    unlinkAsset: useMutation({
      mutationFn: ({ assetId, elementId, organizationId, role }: {
        assetId: string
        elementId: string
        organizationId: string
        role: string
      }) => deleteElementsIdAssetsAssetid(
        { assetId, id: elementId, params: { role } },
        { headers: getOrganizationRequestHeaders(organizationId) },
      ),
      onMutate: async (variables) => {
        const key = elementQueryKeys.kit(
          variables.organizationId,
          variables.elementId,
        )
        await queryClient.cancelQueries({ queryKey: key })
        const previous = queryClient.getQueryData<ElementAssetListResponse>(key)
        updateKitCache(
          queryClient,
          variables.organizationId,
          variables.elementId,
          links => links.filter(link => !(
            link.assetId === variables.assetId
            && link.role === variables.role
          )),
        )
        return {
          key,
          organizationId: variables.organizationId,
          previous,
        }
      },
      onError: (_error, _variables, context) => {
        if (!context || !hasOrganizationScopeCache(
          queryClient,
          context.organizationId,
        )) {
          return
        }
        queryClient.setQueryData(context?.key ?? [], context?.previous)
      },
      onSettled: (_data, _error, { elementId, organizationId }) => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.kit(organizationId, elementId) }),
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.detail(organizationId, elementId) }),
          queryClient.invalidateQueries({ queryKey: elementQueryKeys.lists(organizationId) }),
          queryClient.invalidateQueries({ queryKey: flowQueryKeys.allReferences(organizationId) }),
        ])
      },
    }),
  }
}
