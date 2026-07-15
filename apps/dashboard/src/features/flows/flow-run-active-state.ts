export function stableRunIds(runIds: readonly string[]) {
  return [...new Set(runIds)].toSorted()
}

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
