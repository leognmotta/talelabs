/** Deduplicates run ids while preserving first-seen observation order. */
export function stableRunIds(runIds: readonly string[]) {
  return [...new Set(runIds)].toSorted()
}

/** Adds, removes, or replaces the active run ids tracked by observation. */
export function activeRunIdsReducer(
  current: readonly string[],
  action: { runId: string, type: 'add' | 'remove' },
) {
  if (action.type === 'add') {
    return current.includes(action.runId)
      ? current
      : stableRunIds([...current, action.runId])
  }
  return current.includes(action.runId)
    ? current.filter(runId => runId !== action.runId)
    : current
}
