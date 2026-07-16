import type { AssetType } from '@talelabs/db'
import type { MediaProcessor, ProcessableAssetType } from './contracts.js'

import { audioProcessor } from './audio.js'
import { InvalidMediaError } from './contracts.js'
import { imageProcessor } from './image.js'
import { videoProcessor } from './video.js'

const mediaProcessors = {
  audio: audioProcessor,
  image: imageProcessor,
  video: videoProcessor,
} satisfies Record<ProcessableAssetType, MediaProcessor>

export function getMediaProcessor(type: AssetType) {
  if (!(type in mediaProcessors))
    throw new InvalidMediaError(`Unsupported media type: ${type}.`)

  return mediaProcessors[type as ProcessableAssetType]
}
