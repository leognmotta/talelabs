import type {
  Flow,
  FlowGraphSyncRequest,
  FlowListResponse,
  GetFlowsQueryParams,
} from '@talelabs/sdk'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'

import { GENERATION_REGISTRY_VERSION } from '@talelabs/flows'
import {
  deleteFlowsId,
  getConfigGeneration,
  getFlows,
  getFlowsId,
  getFlowsIdGraph,
  getFlowsIdReferences,
  patchFlowsId,
  postFlows,
  postFlowsIdGraph,
} from '@talelabs/sdk'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import {
  ASSET_MEDIA_REFRESH_INTERVAL_MS,
  ASSET_PROCESSING_REFRESH_INTERVAL_MS,
  assetNeedsProcessingRefresh,
} from '../assets/asset-query-timing'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { flowQueryKeys } from './flow-query-keys'

const FLOW_PAGE_SIZE = 40

function hasOrganizationScopeCache(
  queryClient: QueryClient,
  organizationId: string,
) {
  return queryClient.getQueryCache().findAll({
    queryKey: flowQueryKeys.scope(organizationId),
  }).length > 0
}

function patchFlowLists(
  queryClient: QueryClient,
  organizationId: string,
  flowId: string,
  patch: Partial<Flow>,
) {
  queryClient.setQueriesData<InfiniteData<FlowListResponse>>(
    { queryKey: flowQueryKeys.lists(organizationId) },
    current => current
      ? {
          ...current,
          pages: current.pages.map(page => ({
            ...page,
            data: page.data.map(flow => (
              flow.id === flowId ? { ...flow, ...patch } : flow
            )),
          })),
        }
      : current,
  )
}

function removeFlowFromLists(
  queryClient: QueryClient,
  organizationId: string,
  flowId: string,
) {
  queryClient.setQueriesData<InfiniteData<FlowListResponse>>(
    { queryKey: flowQueryKeys.lists(organizationId) },
    current => current
      ? {
          ...current,
          pages: current.pages.map(page => ({
            ...page,
            data: page.data.filter(flow => flow.id !== flowId),
          })),
        }
      : current,
  )
}

export function useFlowListQuery(search: string) {
  const organizationId = useActiveOrganizationId()
  const params: GetFlowsQueryParams = {
    limit: FLOW_PAGE_SIZE,
    search: search || undefined,
  }

  return useInfiniteQuery({
    queryKey: flowQueryKeys.list(organizationId, params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getFlows(
      { params: { ...params, cursor: pageParam } },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
    placeholderData: (previousData, previousQuery) => (
      previousQuery?.queryKey[1] === organizationId ? previousData : undefined
    ),
  })
}

export function useFlowDetailQuery(flowId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.detail(organizationId, flowId),
    queryFn: ({ signal }) => getFlowsId(
      { id: flowId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: Boolean(organizationId && flowId),
  })
}

export function useFlowGraphQuery(flowId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.graph(organizationId, flowId),
    queryFn: ({ signal }) => getFlowsIdGraph(
      { id: flowId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: Boolean(organizationId && flowId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  })
}

export function useFlowReferencesQuery(flowId: null | string) {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.references(organizationId, flowId),
    queryFn: ({ signal }) => getFlowsIdReferences(
      { id: flowId! },
      {
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      },
    ),
    enabled: Boolean(organizationId && flowId),
    refetchInterval: query => query.state.data?.assets.some(
      assetNeedsProcessingRefresh,
    )
      ? ASSET_PROCESSING_REFRESH_INTERVAL_MS
      : ASSET_MEDIA_REFRESH_INTERVAL_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}

export function useGenerationConfigQuery() {
  const organizationId = useActiveOrganizationId()
  return useQuery({
    queryKey: flowQueryKeys.generationConfig(organizationId),
    queryFn: async ({ signal }) => {
      const config = await getConfigGeneration({
        headers: getOrganizationRequestHeaders(organizationId!),
        signal,
      })
      if (config.registryVersion !== GENERATION_REGISTRY_VERSION) {
        throw new Error(
          `Generation registry mismatch: dashboard=${GENERATION_REGISTRY_VERSION}, api=${config.registryVersion}`,
        )
      }
      return config
    },
    enabled: Boolean(organizationId),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function saveFlowGraph(input: {
  data: FlowGraphSyncRequest
  flowId: string
  organizationId: string
  signal?: AbortSignal
}) {
  return postFlowsIdGraph(
    { id: input.flowId, data: input.data },
    {
      headers: getOrganizationRequestHeaders(input.organizationId),
      signal: input.signal,
    },
  )
}

export function saveFlowViewport(input: {
  flowId: string
  organizationId: string
  viewport: { x: number, y: number, zoom: number }
}) {
  return patchFlowsId(
    { id: input.flowId, data: { viewport: input.viewport } },
    { headers: getOrganizationRequestHeaders(input.organizationId) },
  )
}

export function useCreateFlowMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ name, organizationId }: {
      name: string
      organizationId: string
    }) => postFlows(
      { data: { name } },
      { headers: getOrganizationRequestHeaders(organizationId) },
    ),
    onSuccess: (flow, { organizationId }) => {
      if (!hasOrganizationScopeCache(queryClient, organizationId))
        return
      queryClient.setQueryData(
        flowQueryKeys.detail(organizationId, flow.id),
        flow,
      )
    },
    onSettled: (_data, _error, { organizationId }) => {
      void queryClient.invalidateQueries({
        queryKey: flowQueryKeys.lists(organizationId),
      })
    },
  })
}

export function useRenameFlowMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, organizationId }: {
      id: string
      name: string
      organizationId: string
    }) => patchFlowsId(
      { id, data: { name } },
      { headers: getOrganizationRequestHeaders(organizationId) },
    ),
    onMutate: async ({ id, name, organizationId }) => {
      await queryClient.cancelQueries({
        queryKey: flowQueryKeys.scope(organizationId),
      })
      const lists = queryClient.getQueriesData<InfiniteData<FlowListResponse>>({
        queryKey: flowQueryKeys.lists(organizationId),
      })
      const detail = queryClient.getQueryData<Flow>(
        flowQueryKeys.detail(organizationId, id),
      )
      patchFlowLists(queryClient, organizationId, id, { name })
      queryClient.setQueryData<Flow>(
        flowQueryKeys.detail(organizationId, id),
        current => current ? { ...current, name } : current,
      )
      return { detail, lists, organizationId }
    },
    onError: (_error, { id }, context) => {
      if (!context || !hasOrganizationScopeCache(queryClient, context.organizationId))
        return
      queryClient.setQueryData(
        flowQueryKeys.detail(context.organizationId, id),
        context.detail,
      )
      for (const [key, value] of context.lists)
        queryClient.setQueryData(key, value)
    },
    onSuccess: (flow, { organizationId }) => {
      if (!hasOrganizationScopeCache(queryClient, organizationId))
        return
      patchFlowLists(queryClient, organizationId, flow.id, flow)
      queryClient.setQueryData(
        flowQueryKeys.detail(organizationId, flow.id),
        flow,
      )
    },
    onSettled: (_data, _error, { organizationId }) => {
      void queryClient.invalidateQueries({
        queryKey: flowQueryKeys.lists(organizationId),
      })
    },
  })
}

export function useDeleteFlowMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, organizationId }: {
      id: string
      organizationId: string
    }) => deleteFlowsId(
      { id },
      { headers: getOrganizationRequestHeaders(organizationId) },
    ),
    onMutate: async ({ id, organizationId }) => {
      await queryClient.cancelQueries({
        queryKey: flowQueryKeys.scope(organizationId),
      })
      const lists = queryClient.getQueriesData<InfiniteData<FlowListResponse>>({
        queryKey: flowQueryKeys.lists(organizationId),
      })
      removeFlowFromLists(queryClient, organizationId, id)
      return { lists, organizationId }
    },
    onError: (_error, _variables, context) => {
      if (!context || !hasOrganizationScopeCache(queryClient, context.organizationId))
        return
      for (const [key, value] of context.lists)
        queryClient.setQueryData(key, value)
    },
    onSuccess: (_data, { id, organizationId }) => {
      queryClient.removeQueries({
        queryKey: flowQueryKeys.detail(organizationId, id),
      })
      queryClient.removeQueries({
        queryKey: flowQueryKeys.graph(organizationId, id),
      })
    },
    onSettled: (_data, _error, { organizationId }) => {
      void queryClient.invalidateQueries({
        queryKey: flowQueryKeys.lists(organizationId),
      })
    },
  })
}
