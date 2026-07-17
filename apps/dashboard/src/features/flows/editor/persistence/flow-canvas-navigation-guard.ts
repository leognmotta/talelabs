/** Route-leave predicate used to hand dirty Flow revisions to background save. */

import type { BlockerFunction } from 'react-router'

/** Pauses a pathname change only long enough to dispatch a background save. */
export function shouldBlockFlowCanvasNavigation(
  allowNavigationRef: { current: boolean },
  /** Whether the scoped graph has local revisions not acknowledged by autosave. */
  dirty: boolean,
  /** Current and proposed locations supplied by React Router. */
  input: Parameters<BlockerFunction>[0],
): boolean {
  return !allowNavigationRef.current
    && dirty
    && input.currentLocation.pathname !== input.nextLocation.pathname
}
