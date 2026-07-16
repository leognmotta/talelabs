/** Flow detail, graph, and Asset-reference server-state queries. */

import {
  getFlowsId,
  getFlowsIdGraph,
  getFlowsIdReferences,
} from '@talelabs/sdk'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import {
  ASSET_MEDIA_REFRESH_INTERVAL_MS,
  ASSET_PROCESSING_REFRESH_INTERVAL_MS,
  assetNeedsProcessingRefresh,
} from '../assets/asset-query-timing'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { flowQueryKeys } from './flow-query-keys'

/** Loads one Flow's metadata. */
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

/** Loads one Flow's editable graph and retains it until explicit invalidation. */
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

/** Loads and refreshes one Flow's referenced Asset projections. */
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
