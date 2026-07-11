import type { RefObject } from 'react'

import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

export function useDraggableLibraryItem<TData extends Record<string, unknown>>({
  dragHandleRef,
  elementRef,
  getData,
  onDragStart,
}: {
  dragHandleRef: RefObject<HTMLElement | null>
  elementRef: RefObject<HTMLElement | null>
  getData: () => TData
  onDragStart: () => void
}) {
  const getDataRef = useRef(getData)
  const onDragStartRef = useRef(onDragStart)
  const suppressClickRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewContainer, setPreviewContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    getDataRef.current = getData
    onDragStartRef.current = onDragStart
  })

  useEffect(() => {
    const element = elementRef.current
    const dragHandle = dragHandleRef.current
    if (!element || !dragHandle)
      return

    return draggable({
      element,
      dragHandle,
      getInitialData: () => getDataRef.current(),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: pointerOutsideOfPreview({ x: '16px', y: '8px' }),
          render: ({ container }) => {
            // The browser captures the native preview before an async React render can commit.
            // eslint-disable-next-line react/dom-no-flush-sync
            flushSync(() => setPreviewContainer(container))
            return () => setPreviewContainer(null)
          },
        })
      },
      onDragStart: () => {
        suppressClickRef.current = true
        setIsDragging(true)
        onDragStartRef.current()
      },
      onDrop: () => {
        setIsDragging(false)
        requestAnimationFrame(() => {
          suppressClickRef.current = false
        })
      },
    })
  }, [dragHandleRef, elementRef])

  return {
    isDragging,
    previewContainer,
    shouldIgnoreClick: () => suppressClickRef.current,
  }
}
