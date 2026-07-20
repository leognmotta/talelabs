/** Layout boundary for generated media or text between inputs and output controls. */

import type { ReactNode } from 'react'

import { GenerationPreviewActions } from './generation-preview-actions'

/**
 * Provides the media/output region between prompt inputs and the output
 * footer, and overlays the node's hover-revealed output commands.
 */
export function GenerationNodePreviewArea({
  children,
  nodeId,
}: {
  children: ReactNode
  nodeId: string
}) {
  return (
    <div className="relative">
      {children}
      <GenerationPreviewActions nodeId={nodeId} />
    </div>
  )
}
