/** Bounded delayed recovery for cost estimates that remain incomplete. */

import { useCallback, useEffect, useReducer, useRef } from 'react'

const INCOMPLETE_ESTIMATE_RECOVERY_DELAYS_MS = [
  30_000,
  60_000,
  120_000,
] as const

interface EstimateRecoveryScope {
  complete: boolean
  id: string
}

interface EstimateRecoveryState {
  attempts: number
  groupKey: string
  incompleteScopeIds: Set<string>
}

/**
 * Schedules a small exponential recovery budget only while known scopes are
 * incomplete. Changing the estimate group or completing every scope restores
 * the budget; normal query retries remain independently bounded.
 */
export function useBoundedIncompleteEstimateRecovery(input: {
  /** Whether automatic recovery is currently allowed. */
  active: boolean
  /** Identity shared by the scopes that must recover together. */
  groupKey: string
  /** Whether the owning query is already making a request. */
  recovering: boolean
  /** Invalidates or refetches the incomplete scopes when a delay elapses. */
  recover: () => void
}): (scopes: readonly EstimateRecoveryScope[]) => void {
  const { active, groupKey, recover, recovering } = input
  const stateRef = useRef<EstimateRecoveryState>({
    attempts: 0,
    groupKey,
    incompleteScopeIds: new Set(),
  })
  const [revision, advanceRevision] = useReducer(value => value + 1, 0)

  useEffect(() => {
    const state = stateRef.current
    if (state.groupKey === groupKey)
      return
    stateRef.current = {
      attempts: 0,
      groupKey,
      incompleteScopeIds: new Set(),
    }
    advanceRevision()
  }, [groupKey])

  useEffect(() => {
    const state = stateRef.current
    if (
      !active
      || recovering
      || state.groupKey !== groupKey
      || state.incompleteScopeIds.size === 0
      || state.attempts >= INCOMPLETE_ESTIMATE_RECOVERY_DELAYS_MS.length
    ) {
      return undefined
    }
    const attempt = state.attempts
    const timeout = window.setTimeout(() => {
      const current = stateRef.current
      if (
        current.groupKey !== groupKey
        || current.attempts !== attempt
        || current.incompleteScopeIds.size === 0
      ) {
        return
      }
      current.attempts += 1
      recover()
    }, INCOMPLETE_ESTIMATE_RECOVERY_DELAYS_MS[attempt])
    return () => window.clearTimeout(timeout)
  }, [
    active,
    groupKey,
    recover,
    recovering,
    revision,
  ])

  return useCallback((scopes) => {
    const state = stateRef.current
    if (state.groupKey !== groupKey)
      return
    let changed = false
    for (const scope of scopes) {
      const wasIncomplete = state.incompleteScopeIds.has(scope.id)
      if (scope.complete && wasIncomplete) {
        state.incompleteScopeIds.delete(scope.id)
        changed = true
      }
      else if (!scope.complete && !wasIncomplete) {
        state.incompleteScopeIds.add(scope.id)
        changed = true
      }
    }
    if (state.incompleteScopeIds.size === 0 && state.attempts !== 0) {
      state.attempts = 0
      changed = true
    }
    if (changed)
      advanceRevision()
  }, [groupKey])
}
