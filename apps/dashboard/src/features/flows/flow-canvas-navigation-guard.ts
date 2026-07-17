/** Navigation-blocking predicate for revision-dirty Flow canvases. */

import type { BlockerFunction } from 'react-router'

/** Blocks only real location changes while the graph has unsaved revisions. */
export function shouldBlockFlowCanvasNavigation(
  allowNavigationRef: { current: boolean },
  /** Whether the scoped graph has local revisions not acknowledged by autosave. */
  dirty: boolean,
  /** Current and proposed locations supplied by React Router. */
  input: Parameters<BlockerFunction>[0],
): boolean {
  return !allowNavigationRef.current
    && dirty
    && (
      input.currentLocation.pathname !== input.nextLocation.pathname
      || input.currentLocation.search !== input.nextLocation.search
      || input.currentLocation.hash !== input.nextLocation.hash
    )
}
