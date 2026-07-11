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

export function AssetMediaPreview({
  asset,
  className,
  mode = 'thumbnail',
  videoPreviewActive = false,
  videoRef,
}: {
  asset: Asset
  className?: string
  mode?: 'player' | 'thumbnail'
  videoPreviewActive?: boolean
  videoRef?: Ref<HTMLVideoElement>
}) {
  if (asset.processingState === 'processing')
    return <Skeleton className={cn('size-full rounded-none', className)} />

  if (asset.type === 'image' && asset.url) {
    return (
      <img
        alt={asset.name}
        className={cn('size-full object-contain', className)}
        draggable={false}
        loading="lazy"
        src={mode === 'player' ? asset.url : asset.thumbnailUrl ?? asset.url}
      />
    )
  }

  if (asset.type === 'video') {
    if (asset.url && (mode === 'player' || videoPreviewActive)) {
      return (
        <AssetVideoPreview
          className={className}
          mode={mode}
          name={asset.name}
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
        <audio aria-label={asset.name} className="w-full" controls src={asset.url} />
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
