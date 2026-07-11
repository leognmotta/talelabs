import type { MediaProcessor } from './media-processor.js'

import sharp from 'sharp'

import { InvalidMediaError } from './media-processor.js'

function getImageRotation(orientation: number | undefined) {
  if (orientation === 3 || orientation === 4)
    return 180
  if (orientation === 5 || orientation === 6)
    return 90
  if (orientation === 7 || orientation === 8)
    return 270
  return 0
}

export const imageProcessor: MediaProcessor = {
  async process({ sourcePath }) {
    const image = sharp(sourcePath, { animated: false })
    const metadata = await image.metadata()
    if (!metadata.width || !metadata.height)
      throw new InvalidMediaError('Image dimensions could not be read.')

    const rotationDegrees = getImageRotation(metadata.orientation)
    const swapsDimensions = [5, 6, 7, 8].includes(metadata.orientation ?? 1)
    const thumbnail = await image
      .clone()
      .rotate()
      .resize({
        fit: 'inside',
        height: 640,
        width: 640,
        withoutEnlargement: true,
      })
      .jpeg({ progressive: true, quality: 82 })
      .toBuffer()

    return {
      durationSeconds: null,
      height: swapsDimensions ? metadata.width : metadata.height,
      metadata: {
        format: metadata.format ?? null,
        hasAlpha: metadata.hasAlpha ?? false,
        orientation: metadata.orientation ?? null,
        rotationDegrees,
        space: metadata.space ?? null,
      },
      thumbnail,
      width: swapsDimensions ? metadata.height : metadata.width,
    }
  },
}
