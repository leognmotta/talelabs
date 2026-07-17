/** Provider that preserves media preview identity across node rerenders and runs. */

import type { ReactNode } from 'react'

import { useMemo, useState } from 'react'
import { FlowMediaPreviewContext } from './flow-media-preview-context'

/** Ensures starting one node preview pauses any previously active canvas media. */
export function FlowMediaPreviewProvider({ children }: { children: ReactNode }) {
  const [activeNodeId, setActiveNodeId] = useState<null | string>(null)
  const value = useMemo(() => ({
    activeNodeId,
    activateNode: setActiveNodeId,
  }), [activeNodeId])

  return (
    <FlowMediaPreviewContext value={value}>
      {children}
    </FlowMediaPreviewContext>
  )
}
