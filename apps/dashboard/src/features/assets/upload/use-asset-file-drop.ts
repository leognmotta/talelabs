/** Window drag listener that admits supported files into one owning drop surface. */

import type { DragEvent } from 'react'
import type { AssetUploadSelection } from './asset-upload-selection-contract'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAssetUploadSelections,
  getDroppedAssetUploadSelections,
} from './asset-upload-selection'

function containsFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/** Owns window drag depth and expands a completed drop into upload selections. */
export function useAssetFileDrop({
  onFiles,
}: {
  onFiles: (files: AssetUploadSelection[]) => Promise<void> | void
}) {
  const onFilesRef = useRef(onFiles)
  const dragDepthRef = useRef(0)
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)

  useEffect(() => {
    onFilesRef.current = onFiles
  })

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!containsFiles(event))
      return

    event.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFiles(true)
  }, [])

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!containsFiles(event))
      return

    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0)
      setIsDraggingFiles(false)
  }, [])

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!containsFiles(event))
      return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback((event: DragEvent<HTMLElement>) => {
    if (!containsFiles(event))
      return

    event.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFiles(false)
    const dataTransfer = event.dataTransfer
    const fallbackSelections = getAssetUploadSelections(dataTransfer.files)
    void getDroppedAssetUploadSelections(dataTransfer)
      .then(selections => onFilesRef.current(selections))
      .catch(() => onFilesRef.current(fallbackSelections))
  }, [])

  return {
    dropTargetProps: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
    },
    isDraggingFiles,
  }
}
