import type { FlowImageCrop } from '@talelabs/flows'

export const FULL_IMAGE_CROP: FlowImageCrop = Object.freeze({
  height: 1,
  width: 1,
  x: 0,
  y: 0,
})

const MAXIMUM_IMAGE_NODE_ASPECT_RATIO = 2
const MINIMUM_IMAGE_NODE_ASPECT_RATIO = 1 / 2

export function roundImageCrop(crop: FlowImageCrop): FlowImageCrop {
  return {
    height: Number(crop.height.toFixed(4)),
    width: Number(crop.width.toFixed(4)),
    x: Number(crop.x.toFixed(4)),
    y: Number(crop.y.toFixed(4)),
  }
}

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

export function isFullImageCrop(crop: FlowImageCrop) {
  return crop.x <= 0.0001
    && crop.y <= 0.0001
    && crop.width >= 0.9999
    && crop.height >= 0.9999
}

export function imageCropAspectRatio(
  crop: FlowImageCrop,
  sourceWidth: null | number,
  sourceHeight: null | number,
) {
  const sourceAspectRatio = sourceWidth && sourceHeight
    ? sourceWidth / sourceHeight
    : 1
  return sourceAspectRatio * crop.width / crop.height
}

export function imageNodeDisplayAspectRatio(contentAspectRatio: number) {
  return Math.min(
    MAXIMUM_IMAGE_NODE_ASPECT_RATIO,
    Math.max(MINIMUM_IMAGE_NODE_ASPECT_RATIO, contentAspectRatio),
  )
}

export function getContainedMediaSize(
  contentAspectRatio: number,
  frameAspectRatio: number,
) {
  if (contentAspectRatio >= frameAspectRatio) {
    return {
      height: `${frameAspectRatio / contentAspectRatio * 100}%`,
      width: '100%',
    }
  }
  return {
    height: '100%',
    width: `${contentAspectRatio / frameAspectRatio * 100}%`,
  }
}
