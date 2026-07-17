/** Debounced server persistence for React Flow viewport presentation state. */

import type { OnMoveEnd, Viewport } from '@xyflow/react'

import { useCallback, useEffect, useRef } from 'react'
import { saveFlowViewport } from './flow-save'

const VIEWPORT_SAVE_DELAY_MS = 300

/** Returns a React Flow move-end handler that persists only the latest viewport. */
export function useFlowViewportPersistence(input: {
  /** Flow whose viewport is being persisted. */
  flowId: string
  /** Reports the latest failed viewport write after queued work settles. */
  onError: () => void
  /** Organization that owns the Flow. */
  organizationId: string
}) {
  const pendingViewportRef = useRef<null | Viewport>(null)
  const savePromiseRef = useRef<null | Promise<void>>(null)
  const timerRef = useRef<null | number>(null)
  const mountedRef = useRef(true)
  const onErrorRef = useRef(input.onError)
  onErrorRef.current = input.onError

  const clearTimer = useCallback(() => {
    if (timerRef.current === null)
      return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const performSave = useCallback(async () => {
    let latestSaveFailed = false

    while (pendingViewportRef.current) {
      const viewport = pendingViewportRef.current
      pendingViewportRef.current = null
      try {
        await saveFlowViewport({
          flowId: input.flowId,
          organizationId: input.organizationId,
          viewport,
        })
        latestSaveFailed = false
      }
      catch {
        latestSaveFailed = pendingViewportRef.current === null
      }
    }

    if (latestSaveFailed && mountedRef.current)
      onErrorRef.current()
  }, [input.flowId, input.organizationId])

  const flush = useCallback(() => {
    if (!savePromiseRef.current) {
      savePromiseRef.current = performSave().finally(() => {
        savePromiseRef.current = null
      })
    }
    return savePromiseRef.current
  }, [performSave])

  const schedule = useCallback<OnMoveEnd>((_event, viewport) => {
    pendingViewportRef.current = viewport
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flush()
    }, VIEWPORT_SAVE_DELAY_MS)
  }, [clearTimer, flush])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
      if (pendingViewportRef.current)
        void flush()
    }
  }, [clearTimer, flush])

  return schedule
}
