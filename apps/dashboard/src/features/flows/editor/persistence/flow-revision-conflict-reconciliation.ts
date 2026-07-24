/** Shared bounded reconciliation primitives for Flow graph revision conflicts. */

import type { FlowGraphResponse } from '@talelabs/sdk'
import type { PersistedCanvasGraph } from '../flow-canvas-types'

import { getFlowsIdGraph } from '@talelabs/sdk'
import { ApiError } from '@talelabs/sdk/client'
import { getApiErrorCode } from '../../../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../../../shared/lib/organization-request'
import { createFlowGraphDiff } from './flow-graph-diff'
import { replayFlowGraphDiff } from './flow-graph-diff-replay'

/** Maximum compare-and-swap conflicts replayed within one save command. */
export const MAX_FLOW_GRAPH_CONFLICT_REPLAYS = 3

/** Returns whether an API failure is the Flow graph revision conflict contract. */
export function isFlowGraphRevisionConflict(error: unknown) {
  return error instanceof ApiError
    && error.status === 409
    && getApiErrorCode(error) === 'revision_conflict'
}

/**
 * Fetches the latest server graph, captures local edits after that request,
 * and replays only the local diff over the refreshed compare-and-swap base.
 */
export async function reconcileFlowGraphRevisionConflict(input: {
  /** Last server graph on which the local editor state was based. */
  baseline: PersistedCanvasGraph
  /** Flow whose latest graph revision must be loaded. */
  flowId: string
  /** Reads the newest local graph after the server request completes. */
  getLocalGraph: () => PersistedCanvasGraph
  /** Tenant owning the Flow and graph request. */
  organizationId: string
}): Promise<{
  /** Edge ids removed because reconciliation removed one of their endpoints. */
  droppedEdgeIds: string[]
  /** Latest authoritative response used as the next save baseline. */
  server: FlowGraphResponse
  /** Latest server graph with the captured local diff replayed over it. */
  target: PersistedCanvasGraph
}> {
  const server = await getFlowsIdGraph(
    { id: input.flowId },
    { headers: getOrganizationRequestHeaders(input.organizationId) },
  )
  const serverGraph = {
    edges: server.edges,
    nodes: server.nodes,
  }
  const localDiff = createFlowGraphDiff(
    input.baseline,
    input.getLocalGraph(),
  )
  const replay = replayFlowGraphDiff(serverGraph, localDiff)
  return {
    droppedEdgeIds: replay.droppedEdgeIds,
    server,
    target: replay.graph,
  }
}
