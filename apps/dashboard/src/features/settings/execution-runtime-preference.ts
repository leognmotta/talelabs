/** Code-owned runtime preference seam while managed selection remains hidden. */

import type { FlowRunExecutionRuntime } from '@talelabs/flows'

import { BROWSER_EXECUTION_ENABLED } from '@talelabs/flows'

import { useCallback, useSyncExternalStore } from 'react'

const PREFERENCE_EVENT = 'talelabs-execution-runtime-changed'
const MANAGED_EXECUTION_PREFERENCE_ENABLED = false
/** Browser event that restarts executors after local key storage changes. */
export const BROWSER_CREDENTIALS_CHANGED_EVENT = 'talelabs-browser-credentials-changed'

/** Notifies the local executor without exposing credential material. */
export function notifyBrowserCredentialsChanged() {
  window.dispatchEvent(new Event(BROWSER_CREDENTIALS_CHANGED_EVENT))
}

function preferenceKey(userId: string) {
  return `talelabs.executionRuntime.v1.${userId}`
}

/** Returns browser execution while the managed runtime selector is unavailable. */
export function readExecutionRuntimePreference(userId: string | undefined): FlowRunExecutionRuntime {
  if (!BROWSER_EXECUTION_ENABLED)
    return 'managed'
  if (!MANAGED_EXECUTION_PREFERENCE_ENABLED)
    return 'browser'
  if (!userId)
    return 'browser'
  return localStorage.getItem(preferenceKey(userId)) === 'managed'
    ? 'managed'
    : 'browser'
}

/** Keeps the effective runtime synchronized without adding run state to Zustand. */
export function useExecutionRuntimePreference(userId: string | undefined) {
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
    () => readExecutionRuntimePreference(userId),
    [userId],
  )
  const runtime = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): FlowRunExecutionRuntime => BROWSER_EXECUTION_ENABLED ? 'browser' : 'managed',
  )
  const setRuntime = useCallback((next: FlowRunExecutionRuntime) => {
    if (!userId || !MANAGED_EXECUTION_PREFERENCE_ENABLED)
      return
    localStorage.setItem(preferenceKey(userId), next)
    window.dispatchEvent(new Event(PREFERENCE_EVENT))
  }, [userId])
  return [runtime, setRuntime] as const
}
