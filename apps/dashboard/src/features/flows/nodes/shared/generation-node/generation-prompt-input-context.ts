/** React context and target-scoped selector for generation prompt inputs. */

import type { GenerationPromptInputIndex } from './generation-prompt-input-index'

import {
  createContext,
  use,
  useCallback,
  useSyncExternalStore,
} from 'react'

/** Flow-scoped prompt-input index shared by mounted generation nodes. */
export const GenerationPromptInputIndexContext
  = createContext<GenerationPromptInputIndex | null>(null)

/** Selects only the effective prompt inputs for one generation node. */
export function useGenerationPromptInputs(nodeId: string) {
  const index = use(GenerationPromptInputIndexContext)
  if (!index)
    throw new Error('GenerationPromptInputIndexProvider is unavailable.')
  const subscribe = useCallback(
    (listener: () => void) => index.subscribe(nodeId, listener),
    [index, nodeId],
  )
  const getSnapshot = useCallback(
    () => index.getSnapshot(nodeId),
    [index, nodeId],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
