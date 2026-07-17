/** Layout boundary for generated media or text between inputs and output controls. */

import type { ReactNode } from 'react'

/** Provides the media/output region between prompt inputs and the output footer. */
export function GenerationNodePreviewArea({ children }: { children: ReactNode }) {
  return <div className="relative">{children}</div>
}
