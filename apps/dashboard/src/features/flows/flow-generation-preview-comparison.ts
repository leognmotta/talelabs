import type { FlowGenerationPreview } from './flow-canvas-types'

export function areGenerationPreviewsEqual(
  left: FlowGenerationPreview,
  right: FlowGenerationPreview,
) {
  return JSON.stringify(left) === JSON.stringify(right)
}
