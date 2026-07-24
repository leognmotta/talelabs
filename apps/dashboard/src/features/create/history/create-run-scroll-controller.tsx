/** Explicit Create run focus over shadcn's user-aware message scroller. */

import type { RefObject } from 'react'

import { useMessageScroller } from '@talelabs/ui/components/message-scroller'
import { useEffect } from 'react'

const USER_SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  ' ',
])

/** Follows the run admitted by Generate once its history item is mounted. */
export function CreateRunScrollController({
  targetItemRef,
  targetMounted,
  targetRunId,
  viewportRef,
}: {
  /** Latest generated run item whose media can expand after status changes. */
  targetItemRef: RefObject<HTMLDivElement | null>
  /** Whether the requested run is present in the current history page. */
  targetMounted: boolean
  /** Exact run returned by the latest user-initiated Generate command. */
  targetRunId: null | string
  /** Shadcn message viewport that owns user scroll intent and positioning. */
  viewportRef: RefObject<HTMLDivElement | null>
}) {
  const { scrollToEnd } = useMessageScroller()

  useEffect(() => {
    if (!targetRunId || !targetMounted)
      return
    const target = targetItemRef.current
    const viewport = viewportRef.current
    if (!target || !viewport)
      return

    let following = true
    let frame = 0
    const followTarget = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (following)
          scrollToEnd({ behavior: 'auto' })
      })
    }
    const stopFollowing = () => {
      following = false
    }
    const stopFollowingOnKey = (event: KeyboardEvent) => {
      if (USER_SCROLL_KEYS.has(event.key))
        stopFollowing()
    }
    const stopFollowingOnPointer = (event: PointerEvent) => {
      if (event.target === viewport)
        stopFollowing()
    }

    followTarget()
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(followTarget)
    resizeObserver?.observe(target)
    viewport.addEventListener('keydown', stopFollowingOnKey)
    viewport.addEventListener('pointerdown', stopFollowingOnPointer)
    viewport.addEventListener('touchmove', stopFollowing, { passive: true })
    viewport.addEventListener('wheel', stopFollowing, { passive: true })

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      viewport.removeEventListener('keydown', stopFollowingOnKey)
      viewport.removeEventListener('pointerdown', stopFollowingOnPointer)
      viewport.removeEventListener('touchmove', stopFollowing)
      viewport.removeEventListener('wheel', stopFollowing)
    }
  }, [
    scrollToEnd,
    targetItemRef,
    targetMounted,
    targetRunId,
    viewportRef,
  ])

  return null
}
