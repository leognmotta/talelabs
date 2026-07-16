import type { ChangeEventHandler, ComponentProps } from 'react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { Textarea } from '@talelabs/ui/components/textarea'
import { cn } from '@talelabs/ui/lib/utils'
import { useLayoutEffect, useRef } from 'react'

type FlowNodeTextareaProps = Omit<ComponentProps<'textarea'>, 'ref'>

interface PendingSelection {
  direction: 'backward' | 'forward' | 'none' | null
  end: number
  start: number
  value: string
}

export function FlowNodeTextarea({
  className,
  onChange,
  value,
  ...props
}: FlowNodeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<PendingSelection | null>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea)
      return

    const styles = window.getComputedStyle(textarea)
    const minimumHeight = Number.parseFloat(styles.minHeight)
    const maximumHeight = Number.parseFloat(styles.maxHeight)
    textarea.style.height = '0px'
    const contentHeight = textarea.scrollHeight
    const height = Math.min(
      Math.max(contentHeight, minimumHeight),
      maximumHeight,
    )
    textarea.style.height = `${height}px`
    textarea.style.overflowY = contentHeight > maximumHeight ? 'auto' : 'hidden'

    const pendingSelection = pendingSelectionRef.current
    if (!pendingSelection)
      return
    pendingSelectionRef.current = null
    if (
      document.activeElement !== textarea
      || textarea.value !== pendingSelection.value
    ) {
      return
    }
    textarea.setSelectionRange(
      pendingSelection.start,
      pendingSelection.end,
      pendingSelection.direction ?? undefined,
    )
  }, [value])

  const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
    const nativeEvent = event.nativeEvent
    const composing = 'isComposing' in nativeEvent && nativeEvent.isComposing === true
    pendingSelectionRef.current = composing
      ? null
      : {
          direction: event.currentTarget.selectionDirection,
          end: event.currentTarget.selectionEnd,
          start: event.currentTarget.selectionStart,
          value: event.currentTarget.value,
        }
    onChange?.(event)
  }

  return (
    <Textarea
      ref={textareaRef}
      className={cn(
        `
          nodrag nopan nowheel no-scrollbar field-sizing-fixed max-h-60
          overflow-y-auto overscroll-y-contain
        `,
        className,
      )}
      value={value}
      onChange={handleChange}
      {...props}
    />
  )
}
