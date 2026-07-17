/** Stable React Flow presentation objects derived from localized Flow data. */

import type { Viewport } from '@xyflow/react'

/** Creates the localized React Flow node accessibility description map. */
export function createFlowCanvasAriaLabelConfig(
  /** Localized description announced for interactive canvas nodes. */
  nodeDescription: string,
): Record<'node.a11yDescription.default', string> {
  return { 'node.a11yDescription.default': nodeDescription }
}

/** Copies the persisted viewport into a referentially stable initial value. */
export function createFlowCanvasDefaultViewport(
  /** Persisted Flow viewport read during editor initialization. */
  viewport: Viewport,
): Viewport {
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom }
}
