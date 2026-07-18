/** Dependency-aware descendant skipping after one executable node fails. */

import type { DatabaseExecutor } from '@talelabs/db'
import type { ExecutableFlowRunSnapshot } from '../contracts/snapshot.js'

import { db } from '@talelabs/db'

import { logRunEngine } from '../observability/logging.js'

function descendantNodeIds(
  snapshot: ExecutableFlowRunSnapshot,
  failedNodeIds: readonly string[],
) {
  const executionNodeIds = new Set(
    snapshot.plan.executionNodes.map(node => node.nodeId),
  )
  const childrenByNodeId = new Map<string, string[]>()
  for (const edge of snapshot.plan.capturedEdges) {
    if (
      executionNodeIds.has(edge.sourceNodeId)
      && executionNodeIds.has(edge.targetNodeId)
    ) {
      childrenByNodeId.set(edge.sourceNodeId, [
        ...(childrenByNodeId.get(edge.sourceNodeId) ?? []),
        edge.targetNodeId,
      ])
    }
  }
  const descendants = new Set<string>()
  const pending = [...failedNodeIds]
  while (pending.length > 0) {
    const nodeId = pending.shift()!
    for (const childNodeId of childrenByNodeId.get(nodeId) ?? []) {
      if (descendants.has(childNodeId))
        continue
      descendants.add(childNodeId)
      pending.push(childNodeId)
    }
  }
  return [...descendants].toSorted()
}

/** Skips every pending executable descendant of the supplied failed nodes. */
export async function skipDescendants(
  input: {
    failedNodeIds: readonly string[]
    flowRunId: string
    graphSnapshot: ExecutableFlowRunSnapshot
    organizationId: string
  },
  database: DatabaseExecutor = db,
) {
  const nodeIds = descendantNodeIds(input.graphSnapshot, input.failedNodeIds)
  if (nodeIds.length === 0)
    return []
  const now = new Date()
  await database.updateTable('generationJobs')
    .set({ completedAt: now, status: 'canceled' })
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where('nodeId', 'in', nodeIds)
    .where('status', '=', 'pending')
    .execute()
  await database.updateTable('flowRunNodeItems')
    .set({ status: 'skipped', updatedAt: now })
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where('nodeId', 'in', nodeIds)
    .where('status', '=', 'pending')
    .execute()
  await database.updateTable('flowRunNodes')
    .set({ status: 'skipped', updatedAt: now })
    .where('organizationId', '=', input.organizationId)
    .where('flowRunId', '=', input.flowRunId)
    .where('nodeId', 'in', nodeIds)
    .where('status', '=', 'pending')
    .execute()
  logRunEngine('warn', 'flow_run.worker.descendants_skipped', {
    failedNodeCount: input.failedNodeIds.length,
    organizationId: input.organizationId,
    runId: input.flowRunId,
    skippedNodeCount: nodeIds.length,
  })
  return nodeIds
}
