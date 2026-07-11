import type { SearchAsset } from '@talelabs/sdk'

import {
  IconFileMusic,
  IconFileUnknown,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-react'

export function GlobalSearchAssetThumbnail({ asset }: { asset: SearchAsset }) {
  if (asset.thumbnailUrl) {
    return (
      <img
        alt=""
        className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-border"
        loading="lazy"
        src={asset.thumbnailUrl}
      />
    )
  }

  const Icon = asset.type === 'audio'
    ? IconFileMusic
    : asset.type === 'video'
      ? IconVideo
      : asset.type === 'image'
        ? IconPhoto
        : IconFileUnknown

  return (
    <span className="
      flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted
      ring-1 ring-border
    "
    >
      <Icon aria-hidden className="text-muted-foreground" />
    </span>
  )
}
