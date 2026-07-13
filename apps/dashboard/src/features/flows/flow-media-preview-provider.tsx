import type { ReactNode } from 'react'

import { useMemo, useState } from 'react'
import { FlowMediaPreviewContext } from './flow-media-preview-context'

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
