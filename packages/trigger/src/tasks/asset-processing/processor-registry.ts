import type { AssetType } from '@talelabs/db'
import type { MediaProcessor, ProcessableAssetType } from './media-processor.js'

import { audioProcessor } from './audio-processor.js'
import { imageProcessor } from './image-processor.js'
import { InvalidMediaError } from './media-processor.js'
import { videoProcessor } from './video-processor.js'

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
