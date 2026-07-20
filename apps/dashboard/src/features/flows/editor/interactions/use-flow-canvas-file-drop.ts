/** Native OS file-drop handling for adding Assets onto the canvas. */

import type { XYPosition } from '@xyflow/react'
import type { DragEvent } from 'react'

import { useCallback, useRef, useState } from 'react'

/** Reports whether a drag payload carries OS files rather than internal drags. */
function hasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * Provides drag handlers and active state for dropping OS files on the canvas.
 * A depth counter tolerates dragenter/dragleave fired by descendant elements so
 * the overlay does not flicker, and only file payloads are accepted — internal
 * pragmatic-drag-and-drop drags carry no `Files` type and are ignored.
 */
export function useFlowCanvasFileDrop(input: {
  uploadFilesAt: (files: FileList, screenPosition: XYPosition) => void
}) {
  const { uploadFilesAt } = input
  const dragDepthRef = useRef(0)
  const [dropActive, setDropActive] = useState(false)

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event))
      return
    event.preventDefault()
    dragDepthRef.current += 1
    setDropActive(true)
  }, [])

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event))
      return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event))
      return
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0)
      setDropActive(false)
  }, [])

  const onDrop = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasFiles(event))
      return
    event.preventDefault()
    dragDepthRef.current = 0
    setDropActive(false)
    const { files } = event.dataTransfer
    if (files.length > 0)
      uploadFilesAt(files, { x: event.clientX, y: event.clientY })
  }, [uploadFilesAt])

  return {
    dropActive,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
  }
}
