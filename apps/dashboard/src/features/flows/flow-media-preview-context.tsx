import { createContext, use } from 'react'

export interface FlowMediaPreviewContextValue {
  activeNodeId: null | string
  activateNode: (nodeId: string) => void
}

export const FlowMediaPreviewContext
  = createContext<FlowMediaPreviewContextValue | null>(null)

export function useFlowMediaPreview() {
  const value = use(FlowMediaPreviewContext)
  if (!value)
    throw new Error('FlowMediaPreviewContext is unavailable.')
  return value
}
