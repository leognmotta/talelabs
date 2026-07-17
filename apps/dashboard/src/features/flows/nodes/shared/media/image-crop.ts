/** Persisted normalized crop contract shared by Asset and image-generation nodes. */

import type { FlowImageCrop } from '@talelabs/flows'

/** Normalized persisted crop values shared by Asset and generation image nodes. */
export const FULL_IMAGE_CROP: FlowImageCrop = Object.freeze({
  height: 1,
  width: 1,
  x: 0,
  y: 0,
})

/** Rounds crop coordinates to the persistence precision used by node data. */
export function roundImageCrop(crop: FlowImageCrop): FlowImageCrop {
  return {
    height: Number(crop.height.toFixed(4)),
    width: Number(crop.width.toFixed(4)),
    x: Number(crop.x.toFixed(4)),
    y: Number(crop.y.toFixed(4)),
  }
}

/** Validates unknown node data as a finite normalized crop inside the source image. */
export function readImageCrop(value: unknown): FlowImageCrop | null {
  if (!value || Array.isArray(value) || typeof value !== 'object')
    return null
  const crop = value as Record<string, unknown>
  if (
    typeof crop.x !== 'number'
    || typeof crop.y !== 'number'
    || typeof crop.width !== 'number'
    || typeof crop.height !== 'number'
    || !Number.isFinite(crop.x)
    || !Number.isFinite(crop.y)
    || !Number.isFinite(crop.width)
    || !Number.isFinite(crop.height)
    || crop.x < 0
    || crop.y < 0
    || crop.width <= 0
    || crop.height <= 0
    || crop.x + crop.width > 1.0001
    || crop.y + crop.height > 1.0001
  ) {
    return null
  }
  return roundImageCrop(crop as unknown as FlowImageCrop)
}

/** Reports whether a crop is equivalent to the complete source image. */
export function isFullImageCrop(crop: FlowImageCrop) {
  return crop.x <= 0.0001
    && crop.y <= 0.0001
    && crop.width >= 0.9999
    && crop.height >= 0.9999
}
