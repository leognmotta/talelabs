/** React lifetime provider for the Flow prompt-input index. */

import type { ReactNode } from 'react'

import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStoreApi } from '../../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../../editor/flow-canvas-runtime-context'
import { GenerationPromptInputIndexContext } from './generation-prompt-input-context'
import { createGenerationPromptInputIndex } from './generation-prompt-input-index'

/** Owns the single prompt-input index for one mounted Flow canvas. */
export function GenerationPromptInputIndexProvider({
  children,
}: {
  /** Canvas descendants that consume target-scoped prompt inputs. */
  children: ReactNode
}) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const index = useMemo(() => createGenerationPromptInputIndex({
    getGenerationPreview: runtime.getGenerationPreview,
    referenceData: runtime.referenceData,
    store,
    subscribeGenerationPreviews: runtime.subscribeGenerationPreviews,
    t,
  }), [
    runtime.getGenerationPreview,
    runtime.referenceData,
    runtime.subscribeGenerationPreviews,
    store,
    t,
  ])

  useEffect(() => index.start(), [index])

  return (
    <GenerationPromptInputIndexContext value={index}>
      {children}
    </GenerationPromptInputIndexContext>
  )
}
