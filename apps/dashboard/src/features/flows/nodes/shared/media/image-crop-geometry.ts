/** Crop and frame aspect-ratio geometry shared by image preview and editing UI. */

import type { FlowImageCrop } from '@talelabs/flows'

const MAXIMUM_IMAGE_NODE_ASPECT_RATIO = 2
const MINIMUM_IMAGE_NODE_ASPECT_RATIO = 1 / 2

/** Returns the visible crop's aspect ratio in source-image coordinates. */
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

/** Clamps an image node frame to the approved one-half-to-two aspect range. */
export function imageNodeDisplayAspectRatio(contentAspectRatio: number) {
  return Math.min(
    MAXIMUM_IMAGE_NODE_ASPECT_RATIO,
    Math.max(MINIMUM_IMAGE_NODE_ASPECT_RATIO, contentAspectRatio),
  )
}

/** Returns percentage dimensions that contain media within a fixed-aspect frame. */
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
