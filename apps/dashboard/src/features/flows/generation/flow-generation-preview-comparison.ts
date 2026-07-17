/** Structural equality for deciding whether generation previews need replacement. */

import type { FlowGenerationPreview } from '../editor/flow-canvas-types'

/** Compares preview status, fingerprint, output, and result sets for store updates. */
export function areGenerationPreviewsEqual(
  left: FlowGenerationPreview,
  right: FlowGenerationPreview,
) {
  return JSON.stringify(left) === JSON.stringify(right)
}
