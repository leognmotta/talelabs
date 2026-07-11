import type { Ref } from 'react'

import { cn } from '@talelabs/ui/lib/utils'

export function AssetVideoPreview({
  className,
  mode,
  name,
  poster,
  src,
  videoRef,
}: {
  className?: string
  mode: 'player' | 'thumbnail'
  name: string
  poster?: string
  src: string
  videoRef?: Ref<HTMLVideoElement>
}) {
  if (mode === 'player') {
    return (
      <video
        autoPlay
        aria-label={name}
        className={cn('size-full object-contain', className)}
        controls
        draggable={false}
        playsInline
        poster={poster}
        preload="metadata"
        src={src}
      />
    )
  }

  return (
    <video
      aria-hidden
      className={cn('size-full object-cover', className)}
      draggable={false}
      loop
      muted
      playsInline
      poster={poster}
      preload="metadata"
      ref={videoRef}
      src={src}
      tabIndex={-1}
    />
  )
}
