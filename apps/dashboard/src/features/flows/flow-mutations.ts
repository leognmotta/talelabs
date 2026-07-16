/** Optimistic create, rename, and delete mutations for organization Flows. */

import type { Flow, FlowListResponse } from '@talelabs/sdk'
import type { InfiniteData } from '@tanstack/react-query'

import { deleteFlowsId, patchFlowsId, postFlows } from '@talelabs/sdk'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import {
  hasOrganizationScopeCache,
  patchFlowLists,
  removeFlowFromLists,
} from './flow-cache'
import { flowQueryKeys } from './flow-query-keys'

/** Creates a Flow and invalidates the active organization's Flow lists. */
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

/** Optimistically renames a Flow across detail and list caches. */
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

/** Optimistically removes a Flow and its detail and graph caches. */
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
