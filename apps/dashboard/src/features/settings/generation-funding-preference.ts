/** Browser-local generation funding preference and runtime projection. */

import type { FlowRunExecutionRuntime } from '@talelabs/flows'

import { useCallback, useSyncExternalStore } from 'react'
import { useExecutionRuntimePreference } from './execution-runtime-preference'

const PREFERENCE_EVENT = 'talelabs-generation-funding-changed'

/** Funding source selected for future live generation runs. */
export type GenerationFundingPreference = 'byok' | 'credits'

function preferenceKey(userId: string) {
  return `talelabs.generationFunding.v1.${userId}`
}

/** Reads a per-user preference while preserving browser BYOK as the default. */
export function readGenerationFundingPreference(
  userId: string | undefined,
): GenerationFundingPreference {
  if (!userId || typeof window === 'undefined')
    return 'byok'
  try {
    return localStorage.getItem(preferenceKey(userId)) === 'credits'
      ? 'credits'
      : 'byok'
  }
  catch {
    return 'byok'
  }
}

/** Maps funding to today's runtime without conflating future managed BYOK. */
export function resolveGenerationExecutionRuntime(
  funding: GenerationFundingPreference,
  byokRuntime: FlowRunExecutionRuntime,
): FlowRunExecutionRuntime {
  return funding === 'credits' ? 'managed' : byokRuntime
}

/** Synchronizes the funding preference across settings, canvases, and tabs. */
export function useGenerationFundingPreference(userId: string | undefined) {
  const subscribe = useCallback((listener: () => void) => {
    const sync = () => listener()
    window.addEventListener('storage', sync)
    window.addEventListener(PREFERENCE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(PREFERENCE_EVENT, sync)
    }
  }, [])
  const getSnapshot = useCallback(
    () => readGenerationFundingPreference(userId),
    [userId],
  )
  const funding = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): GenerationFundingPreference => 'byok',
  )
  const setFunding = useCallback((next: GenerationFundingPreference) => {
    if (!userId)
      return
    try {
      localStorage.setItem(preferenceKey(userId), next)
      window.dispatchEvent(new Event(PREFERENCE_EVENT))
    }
    catch {
      // Browser storage failure leaves the last effective preference unchanged.
    }
  }, [userId])
  return [funding, setFunding] as const
}

/** Resolves the explicit funding source and its current execution driver. */
export function useGenerationExecutionSettings(
  userId: string | undefined,
): readonly [GenerationFundingPreference, FlowRunExecutionRuntime] {
  const [funding] = useGenerationFundingPreference(userId)
  const [byokRuntime] = useExecutionRuntimePreference(userId)
  return [funding, resolveGenerationExecutionRuntime(funding, byokRuntime)]
}
