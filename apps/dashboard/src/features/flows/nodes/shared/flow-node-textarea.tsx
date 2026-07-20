/** Core Flow node rendering primitives shared by current node families. */

import type { ChangeEventHandler, ComponentProps, FocusEventHandler } from 'react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { Textarea } from '@talelabs/ui/components/textarea'
import { cn } from '@talelabs/ui/lib/utils'
import { useLayoutEffect, useRef, useState } from 'react'

type FlowNodeTextareaProps = Omit<ComponentProps<'textarea'>, 'ref'> & {
  /**
   * When true, the field rests at a single line and expands to auto-size while
   * focused, so an unfocused node stays compact but the full prompt is visible
   * during editing.
   */
  collapsible?: boolean
}

interface PendingSelection {
  direction: 'backward' | 'forward' | 'none' | null
  end: number
  start: number
  value: string
}

/** Computes the collapsed single-line height from resolved box metrics. */
function measureSingleLineHeight(styles: CSSStyleDeclaration): number {
  const lineHeight = Number.parseFloat(styles.lineHeight)
  const paddingY = Number.parseFloat(styles.paddingTop)
    + Number.parseFloat(styles.paddingBottom)
  const borderY = Number.parseFloat(styles.borderTopWidth)
    + Number.parseFloat(styles.borderBottomWidth)
  const resolvedLineHeight = Number.isFinite(lineHeight)
    ? lineHeight
    : Number.parseFloat(styles.fontSize) * 1.5
  return resolvedLineHeight + paddingY + borderY
}

/** Provides the nodrag auto-sizing textarea used by editable node prompts. */
export function FlowNodeTextarea({
  className,
  collapsible = false,
  onBlur,
  onChange,
  onFocus,
  value,
  ...props
}: FlowNodeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<PendingSelection | null>(null)
  const [focused, setFocused] = useState(false)
  const collapsed = collapsible && !focused

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea)
      return

    const styles = window.getComputedStyle(textarea)

    if (collapsed) {
      textarea.style.height = `${measureSingleLineHeight(styles)}px`
      textarea.style.overflowY = 'hidden'
      return
    }

    const minimumHeight = Number.parseFloat(styles.minHeight) || 0
    const maximumHeight = Number.parseFloat(styles.maxHeight)
      || Number.POSITIVE_INFINITY
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
  }, [collapsed, value])

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

  const handleFocus: FocusEventHandler<HTMLTextAreaElement> = (event) => {
    setFocused(true)
    onFocus?.(event)
  }

  const handleBlur: FocusEventHandler<HTMLTextAreaElement> = (event) => {
    setFocused(false)
    onBlur?.(event)
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
      rows={1}
      value={value}
      onBlur={handleBlur}
      onChange={handleChange}
      onFocus={handleFocus}
      {...props}
    />
  )
}
