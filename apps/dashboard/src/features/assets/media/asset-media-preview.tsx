/** Media-type dispatch for canonical Asset image, video, and audio previews. */

import type { Asset } from '@talelabs/sdk'
import type { Ref } from 'react'

import {
  IconFileMusic,
  IconFileUnknown,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-react'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { cn } from '@talelabs/ui/lib/utils'
import { AssetVideoPreview } from './asset-video-preview'

/** Selects the image, video, audio, or processing placeholder for one Asset. */
export function AssetMediaPreview({
  asset,
  className,
  mode = 'thumbnail',
  onAspectRatioChange,
  onVideoAspectRatioChange,
  onVideoPlaybackError,
  onVideoPlaying,
  videoAutoPlay = false,
  videoPreviewActive = false,
  videoRef,
}: {
  asset: Pick<
    Asset,
    'id' | 'name' | 'processingState' | 'thumbnailUrl' | 'type' | 'url'
  >
  className?: string
  mode?: 'player' | 'thumbnail'
  onAspectRatioChange?: (aspectRatio: number) => void
  onVideoAspectRatioChange?: (aspectRatio: number) => void
  onVideoPlaybackError?: () => void
  onVideoPlaying?: () => void
  videoAutoPlay?: boolean
  videoPreviewActive?: boolean
  videoRef?: Ref<HTMLVideoElement>
}) {
  if (asset.processingState === 'processing')
    return <Skeleton className={cn('size-full rounded-none', className)} />

  function reportAspectRatio(aspectRatio: number) {
    onAspectRatioChange?.(aspectRatio)
    onVideoAspectRatioChange?.(aspectRatio)
  }

  if (asset.type === 'image' && (asset.thumbnailUrl || asset.url)) {
    const source = mode === 'player'
      ? asset.url ?? asset.thumbnailUrl
      : asset.thumbnailUrl ?? asset.url
    return (
      <img
        alt={asset.name}
        className={cn('size-full object-contain', className)}
        draggable={false}
        loading="lazy"
        src={source!}
        onLoad={(event) => {
          const { naturalHeight, naturalWidth } = event.currentTarget
          if (naturalWidth > 0 && naturalHeight > 0)
            onAspectRatioChange?.(naturalWidth / naturalHeight)
        }}
      />
    )
  }

  if (asset.type === 'video') {
    if (asset.url && (mode === 'player' || videoPreviewActive)) {
      return (
        <AssetVideoPreview
          autoPlay={videoAutoPlay}
          className={className}
          mode={mode}
          name={asset.name}
          onAspectRatioChange={reportAspectRatio}
          onPlaybackError={onVideoPlaybackError}
          onPlaying={onVideoPlaying}
          poster={asset.thumbnailUrl ?? undefined}
          src={asset.url}
          videoRef={videoRef}
        />
      )
    }

    if (mode === 'thumbnail' && asset.thumbnailUrl) {
      return (
        <img
          alt=""
          aria-hidden
          className={cn('size-full object-cover', className)}
          draggable={false}
          loading="lazy"
          src={asset.thumbnailUrl}
          onLoad={(event) => {
            const { naturalHeight, naturalWidth } = event.currentTarget
            if (naturalWidth > 0 && naturalHeight > 0)
              reportAspectRatio(naturalWidth / naturalHeight)
          }}
        />
      )
    }
  }

  if (asset.type === 'audio' && asset.url && mode === 'player') {
    return (
      <div className="
        flex size-full flex-col items-center justify-center gap-6 p-6
      "
      >
        <IconFileMusic aria-hidden className="size-16 text-muted-foreground" />
        <audio
          aria-label={asset.name}
          className="w-full"
          controls
          preload="metadata"
          src={asset.url}
        />
      </div>
    )
  }

  const Icon = asset.type === 'audio'
    ? IconFileMusic
    : asset.type === 'video'
      ? IconVideo
      : asset.type === 'image'
        ? IconPhoto
        : IconFileUnknown

  return <Icon aria-hidden className="size-10 text-muted-foreground" />
}
