/** Non-authoritative same-origin hints that wake the browser execution leader. */

import type { QueryClient } from '@tanstack/react-query'

import { flowQueryKeys } from '../../data/query-keys/flow-query-keys'

const BROWSER_RUN_CHANNEL_PREFIX = 'talelabs.browserRuns'
/** In-window companion event that wakes the admitting tab synchronously. */
export const BROWSER_RUN_HINT_EVENT = 'talelabs:browser-run-changed'

/** Minimal hint exchanged between authenticated TaleLabs tabs. */
export interface BrowserRunHint {
  /** Durable run whose authoritative state should be reconciled. */
  runId: string
  /** Stable hint kind; the receiver must still load server state. */
  type: 'run-changed'
}

/** Returns the tenant/user-scoped channel used only for browser-run wakeups. */
export function browserRunChannelName(organizationId: string, userId: string) {
  return `${BROWSER_RUN_CHANNEL_PREFIX}.${organizationId}.${userId}`
}

/** Reads a bounded non-secret hint from an untrusted channel payload. */
export function parseBrowserRunHint(value: unknown): BrowserRunHint | null {
  if (!value || typeof value !== 'object')
    return null
  const candidate = value as { runId?: unknown, type?: unknown }
  return typeof candidate.runId === 'string'
    && candidate.runId.length > 0
    && candidate.runId.length <= 128
    && candidate.type === 'run-changed'
    ? { runId: candidate.runId, type: candidate.type }
    : null
}

/**
 * Locally hinted run IDs that must survive authoritative discovery responses.
 * A discovery fetch that started before admission can resolve afterwards and
 * overwrite the primed query cache, so hinted IDs are kept here until the
 * server either lists the run or confirms it terminal.
 */
const pendingHintRunIds = new Map<string, Set<string>>()

function hintScope(organizationId: string, userId: string) {
  return `${organizationId}\u0000${userId}`
}

/** Reads hinted run IDs not yet confirmed by authoritative discovery. */
export function readPendingBrowserRunHints(
  organizationId: string,
  userId: string,
) {
  return [...(pendingHintRunIds.get(hintScope(organizationId, userId)) ?? [])]
    .toSorted()
}

/** Drops one hint after an authoritative response accounted for the run. */
export function dischargeBrowserRunHint(
  organizationId: string,
  userId: string,
  runId: string,
) {
  pendingHintRunIds.get(hintScope(organizationId, userId))?.delete(runId)
}

/** Primes the current tab with an admitted run without replacing server truth. */
export function rememberActiveBrowserRun(
  queryClient: QueryClient,
  organizationId: string,
  userId: string,
  runId: string,
) {
  const scope = hintScope(organizationId, userId)
  const hints = pendingHintRunIds.get(scope) ?? new Set<string>()
  hints.add(runId)
  pendingHintRunIds.set(scope, hints)
  queryClient.setQueryData<string[]>(
    flowQueryKeys.activeBrowserRuns(organizationId, userId),
    current => [...new Set([...(current ?? []), runId])].toSorted(),
  )
}

/** Removes a run after an authoritative terminal or missing response. */
export function forgetActiveBrowserRun(
  queryClient: QueryClient,
  organizationId: string,
  userId: string,
  runId: string,
) {
  dischargeBrowserRunHint(organizationId, userId, runId)
  queryClient.setQueryData<string[]>(
    flowQueryKeys.activeBrowserRuns(organizationId, userId),
    current => current?.filter(candidate => candidate !== runId) ?? [],
  )
}

/** Broadcasts a best-effort wakeup without carrying run state or credentials. */
export function publishBrowserRunHint(
  organizationId: string,
  userId: string,
  runId: string,
) {
  const hint = { runId, type: 'run-changed' } satisfies BrowserRunHint
  window.dispatchEvent(new CustomEvent(BROWSER_RUN_HINT_EVENT, { detail: hint }))
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(browserRunChannelName(organizationId, userId))
    channel.postMessage(hint)
  }
  catch {
    // The minute-scale recovery discovery remains authoritative if hints fail.
  }
  finally {
    channel?.close()
  }
}
