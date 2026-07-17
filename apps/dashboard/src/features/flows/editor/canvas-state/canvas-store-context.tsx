/** React boundary for the scoped vanilla store owned by one Flow canvas. */
/* eslint-disable react-refresh/only-export-components -- the scoped provider and its selector hooks share one required boundary. */

import type { ReactNode } from 'react'
import type { CanvasState, CanvasStore } from './canvas-store'

import { createContext, use, useState } from 'react'
import { useStore } from 'zustand'
import { createCanvasStore } from './canvas-store'

const CanvasStoreContext = createContext<CanvasStore | null>(null)

/** Creates and provides one canvas store for the lifetime of a Flow editor. */
export function CanvasStoreProvider({
  children,
  flowId,
  graph,
  organizationId,
}: {
  /** Descendants that render or operate on the canvas. */
  children: ReactNode
  /** Flow identity used to scope the store. */
  flowId: string
  /** Server graph used only for initial store creation. */
  graph: Parameters<typeof createCanvasStore>[0]['graph']
  /** Organization identity used to scope the store. */
  organizationId: string
}) {
  const [store] = useState(() => createCanvasStore({
    flowId,
    graph,
    organizationId,
  }))
  return (
    <CanvasStoreContext value={store}>
      {children}
    </CanvasStoreContext>
  )
}

/** Selects the smallest reactive slice needed by a canvas component. */
export function useCanvasStore<T>(selector: (state: CanvasState) => T): T {
  const store = use(CanvasStoreContext)
  if (!store)
    throw new Error('CanvasStoreContext is unavailable.')
  return useStore(store, selector)
}

/** Returns the imperative store API without subscribing the caller to state. */
export function useCanvasStoreApi(): CanvasStore {
  const store = use(CanvasStoreContext)
  if (!store)
    throw new Error('CanvasStoreContext is unavailable.')
  return store
}
