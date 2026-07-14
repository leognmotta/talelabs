'use client'

import { IconChevronDown } from '@tabler/icons-react'
import { useCallback, useLayoutEffect, useState } from 'react'

export function useScrollOverflowAffordance({
  enabled,
  endItemSelector,
  scrollElement,
}: {
  enabled: boolean
  endItemSelector: string
  scrollElement: HTMLElement | null
}) {
  const [hasMoreAfter, setHasMoreAfter] = useState(false)
  const updateOverflowState = useCallback(() => {
    if (!scrollElement || !enabled) {
      setHasMoreAfter(false)
      return
    }

    const items = scrollElement.querySelectorAll<HTMLElement>(endItemSelector)
    const lastItem = items.item(items.length - 1)

    if (lastItem) {
      const scrollBounds = scrollElement.getBoundingClientRect()
      const lastItemBounds = lastItem.getBoundingClientRect()
      setHasMoreAfter(lastItemBounds.bottom > scrollBounds.bottom + 1)
      return
    }

    const scrollEnd = scrollElement.scrollHeight - scrollElement.clientHeight
    setHasMoreAfter(scrollElement.scrollTop < scrollEnd - 1)
  }, [enabled, endItemSelector, scrollElement])
  const scheduleOverflowUpdate = useCallback(() => {
    requestAnimationFrame(updateOverflowState)
  }, [updateOverflowState])

  useLayoutEffect(() => {
    if (!scrollElement || !enabled)
      return

    const initialMeasurement = requestAnimationFrame(updateOverflowState)
    const resizeObserver = new ResizeObserver(updateOverflowState)
    resizeObserver.observe(scrollElement)

    return () => {
      cancelAnimationFrame(initialMeasurement)
      resizeObserver.disconnect()
    }
  }, [enabled, scrollElement, updateOverflowState])

  return {
    hasMoreAfter,
    scheduleOverflowUpdate,
    updateOverflowState,
  }
}

export function ScrollOverflowAffordance() {
  return (
    <div
      aria-hidden
      className="
        pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-10 items-end
        justify-center bg-linear-to-t from-popover to-transparent pb-1
        text-muted-foreground
      "
      data-slot="scroll-overflow-affordance"
    >
      <IconChevronDown className="size-4" />
    </div>
  )
}
