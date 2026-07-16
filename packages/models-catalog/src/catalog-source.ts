/** Physical JSON sources assembled into the one authoritative model catalog. */

import catalogMetadata from '../catalog.json' with { type: 'json' }
import audioModels from '../models/audio.json' with { type: 'json' }
import imageModels from '../models/image.json' with { type: 'json' }
import textModels from '../models/text.json' with { type: 'json' }
import videoModels from '../models/video.json' with { type: 'json' }

const modelSources = [
  { mediaType: 'image', models: imageModels },
  { mediaType: 'video', models: videoModels },
  { mediaType: 'text', models: textModels },
  { mediaType: 'audio', models: audioModels },
] as const

for (const source of modelSources) {
  for (const [index, model] of source.models.entries()) {
    if (model.mediaType !== source.mediaType) {
      throw new Error(
        `models/${source.mediaType}.json[${index}] must declare mediaType ${source.mediaType}`,
      )
    }
  }
}

/** Raw complete catalog used by runtime parsing and revision verification. */
export const RAW_MODEL_CATALOG = {
  ...catalogMetadata,
  models: [
    ...imageModels,
    ...videoModels,
    ...textModels,
    ...audioModels,
  ],
}
