/** Pointer-interaction lifecycle and normalized geometry for image crop editing. */

import type { FlowImageCrop } from '@talelabs/flows'
import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
} from 'react'

import { roundImageCrop } from './image-crop'

const MINIMUM_CROP_SIZE = 0.08

/** Edge or corner participating in a resize interaction. */
export type CropEdge = 'bottom' | 'left' | 'right' | 'top'

/** Snapshot captured when a crop move or resize begins. */
export interface CropInteraction {
  /** Resize edges; empty for crop-area movement. */
  edges: CropEdge[]
  /** Pixel height used to normalize vertical pointer movement. */
  frameHeight: number
  /** Pixel width used to normalize horizontal pointer movement. */
  frameWidth: number
  /** Whether the pointer moves the crop or one of its boundaries. */
  mode: 'move' | 'resize'
  /** Crop value at pointer-down, retained for stable delta calculation. */
  startCrop: FlowImageCrop
  /** Pointer client X coordinate captured at pointer-down. */
  startX: number
  /** Pointer client Y coordinate captured at pointer-down. */
  startY: number
}

/** Captures pointer and frame state for a primary-button crop interaction. */
export function beginImageCropInteraction(
  event: ReactPointerEvent<HTMLElement>,
  frame: DOMRect | undefined,
  crop: FlowImageCrop,
  mode: CropInteraction['mode'],
  edges: CropEdge[] = [],
): CropInteraction | null {
  if (event.button !== 0 || !frame)
    return null
  event.preventDefault()
  event.stopPropagation()
  event.currentTarget.setPointerCapture(event.pointerId)
  return {
    edges,
    frameHeight: frame.height,
    frameWidth: frame.width,
    mode,
    startCrop: crop,
    startX: event.clientX,
    startY: event.clientY,
  }
}

/** Applies one normalized pointer delta while enforcing crop bounds and minimum size. */
export function updateImageCropInteraction(
  event: ReactPointerEvent<HTMLDivElement>,
  interaction: CropInteraction,
) {
  event.preventDefault()
  event.stopPropagation()
  const deltaX = (event.clientX - interaction.startX) / interaction.frameWidth
  const deltaY = (event.clientY - interaction.startY) / interaction.frameHeight
  const start = interaction.startCrop

  if (interaction.mode === 'move') {
    return roundImageCrop({
      ...start,
      x: Math.min(1 - start.width, Math.max(0, start.x + deltaX)),
      y: Math.min(1 - start.height, Math.max(0, start.y + deltaY)),
    })
  }

  const next = { ...start }
  if (interaction.edges.includes('left')) {
    const right = start.x + start.width
    next.x = Math.min(
      right - MINIMUM_CROP_SIZE,
      Math.max(0, start.x + deltaX),
    )
    next.width = right - next.x
  }
  if (interaction.edges.includes('right')) {
    next.width = Math.min(
      1 - start.x,
      Math.max(MINIMUM_CROP_SIZE, start.width + deltaX),
    )
  }
  if (interaction.edges.includes('top')) {
    const bottom = start.y + start.height
    next.y = Math.min(
      bottom - MINIMUM_CROP_SIZE,
      Math.max(0, start.y + deltaY),
    )
    next.height = bottom - next.y
  }
  if (interaction.edges.includes('bottom')) {
    next.height = Math.min(
      1 - start.y,
      Math.max(MINIMUM_CROP_SIZE, start.height + deltaY),
    )
  }
  return roundImageCrop(next)
}

/** Ends an active interaction after cancel or pointer-up and stops canvas gestures. */
export function endImageCropInteraction(
  event: ReactPointerEvent<HTMLDivElement>,
  interactionRef: RefObject<CropInteraction | null>,
) {
  if (!interactionRef.current)
    return
  event.preventDefault()
  event.stopPropagation()
  interactionRef.current = null
}
