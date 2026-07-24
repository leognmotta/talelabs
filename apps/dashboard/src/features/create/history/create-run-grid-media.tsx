/** Media-only rendering for one Create result inside the bento history view. */

import type { Asset, FlowRunAssetOutput } from '@talelabs/sdk'
import type { Ref } from 'react'

import { IconPhoto, IconVideo } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AssetMediaPreview } from '../../assets/media/asset-media-preview'
import { CreateAudioResult } from './create-audio-result'

/** Fills a grid tile with its canonical image, hover-preview video, or audio player. */
export function CreateRunGridMedia({
  output,
  videoAsset,
  videoPreviewActive,
  videoRef,
}: {
  /** Bounded canonical output projection from direct run history. */
  output: FlowRunAssetOutput
  /** Lazily resolved signed Asset detail used only during video preview intent. */
  videoAsset?: Asset
  /** Whether pointer or keyboard intent currently requests video playback. */
  videoPreviewActive: boolean
  /** Shared preview ref that starts and releases muted video playback. */
  videoRef: Ref<HTMLVideoElement>
}) {
  const { t } = useTranslation()
  const label = t('create.results.generatedMedia', {
    index: output.outputIndex + 1,
  })

  if (output.type === 'audio')
    return <CreateAudioResult output={output} presentation="grid" />

  if (output.type === 'video') {
    if (videoAsset?.url && videoPreviewActive) {
      return (
        <AssetMediaPreview
          asset={videoAsset}
          className="size-full object-cover"
          videoPreviewActive
          videoRef={videoRef}
        />
      )
    }

    return output.thumbnailUrl
      ? (
          <img
            alt={label}
            className="
              size-full object-cover transition-transform duration-300
              group-hover:scale-[1.015]
              motion-reduce:transition-none
            "
            draggable={false}
            loading="lazy"
            src={output.thumbnailUrl}
          />
        )
      : (
          <IconVideo
            aria-label={label}
            className="size-12 text-muted-foreground"
          />
        )
  }

  return output.thumbnailUrl
    ? (
        <img
          alt={label}
          className="
            size-full object-cover transition-transform duration-300
            group-hover:scale-[1.015]
            motion-reduce:transition-none
          "
          draggable={false}
          loading="lazy"
          src={output.thumbnailUrl}
        />
      )
    : (
        <IconPhoto
          aria-label={label}
          className="size-12 text-muted-foreground"
        />
      )
}
