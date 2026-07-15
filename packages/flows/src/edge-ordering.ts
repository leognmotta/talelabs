import { compareStableStrings } from './stable-order.js'

interface OrderedFlowEdge {
  createdAt?: Date | string
  data?: { createdAt?: string }
  id: string
}

/** Matches the persisted Flow contract: creation time first, edge ID as tie-breaker. */
export function compareFlowEdgesByPriority(
  left: Readonly<OrderedFlowEdge>,
  right: Readonly<OrderedFlowEdge>,
) {
  const leftCreatedAt = left.createdAt instanceof Date
    ? left.createdAt.toISOString()
    : left.createdAt ?? left.data?.createdAt ?? ''
  const rightCreatedAt = right.createdAt instanceof Date
    ? right.createdAt.toISOString()
    : right.createdAt ?? right.data?.createdAt ?? ''
  const chronological = compareStableStrings(leftCreatedAt, rightCreatedAt)
  if (chronological !== 0)
    return chronological
  return compareStableStrings(left.id, right.id)
}
