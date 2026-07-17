/** Video preview that separates hover playback from persistent viewer playback. */

import type { Ref, SyntheticEvent } from 'react'

import { cn } from '@talelabs/ui/lib/utils'

/** Displays a muted video thumbnail with intent-driven preview playback. */
export function AssetVideoPreview({
  autoPlay = false,
  className,
  mode,
  name,
  onAspectRatioChange,
  onPlaybackError,
  onPlaying,
  poster,
  src,
  videoRef,
}: {
  autoPlay?: boolean
  className?: string
  mode: 'player' | 'thumbnail'
  name: string
  onAspectRatioChange?: (aspectRatio: number) => void
  onPlaybackError?: () => void
  onPlaying?: () => void
  poster?: string
  src: string
  videoRef?: Ref<HTMLVideoElement>
}) {
  function startPlayback(event: SyntheticEvent<HTMLVideoElement>) {
    if (!autoPlay || !event.currentTarget.paused)
      return
    void event.currentTarget.play().catch(() => onPlaybackError?.())
  }

  function reportAspectRatio(event: SyntheticEvent<HTMLVideoElement>) {
    const { videoHeight, videoWidth } = event.currentTarget
    if (videoWidth > 0 && videoHeight > 0)
      onAspectRatioChange?.(videoWidth / videoHeight)
  }

  if (mode === 'player') {
    return (
      <video
        aria-label={name}
        autoPlay={autoPlay}
        className={cn('size-full object-contain', className)}
        controls
        draggable={false}
        playsInline
        poster={poster}
        preload={autoPlay ? 'auto' : 'metadata'}
        src={src}
        onCanPlay={startPlayback}
        onError={onPlaybackError}
        onLoadedMetadata={reportAspectRatio}
        onPlaying={onPlaying}
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
      onLoadedMetadata={reportAspectRatio}
    />
  )
}
