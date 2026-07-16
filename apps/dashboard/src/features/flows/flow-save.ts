/** Direct Flow graph and viewport persistence commands. */

import type { FlowGraphSyncRequest } from '@talelabs/sdk'

import { patchFlowsId, postFlowsIdGraph } from '@talelabs/sdk'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'

/** Saves a complete revision-checked Flow graph. */
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

/** Persists the latest Flow canvas viewport. */
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
