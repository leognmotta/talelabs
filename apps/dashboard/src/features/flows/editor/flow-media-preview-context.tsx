/** Canvas-scoped registry for media previews keyed independently of node data. */

import { createContext, use } from 'react'

/** Imperative preview registry used to pause media when another node starts playback. */
export interface FlowMediaPreviewContextValue {
  activeNodeId: null | string
  activateNode: (nodeId: string) => void
}

/** Provides the canvas-scoped media preview registry to descendant nodes. */
export const FlowMediaPreviewContext
  = createContext<FlowMediaPreviewContextValue | null>(null)

/** Reads the canvas media preview registry and fails outside its provider. */
export function useFlowMediaPreview() {
  const value = use(FlowMediaPreviewContext)
  if (!value)
    throw new Error('FlowMediaPreviewContext is unavailable.')
  return value
}
