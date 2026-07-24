/**
 * Lazily signed video or audio preview for an active Project Brief mention.
 */

import type { ProjectMentionResolution } from '@talelabs/sdk'

import { useEffect, useRef } from 'react'

import { useAssetDetailQuery } from '../../assets/data/asset-queries'
import { ProjectBriefAssetPoster } from './project-brief-asset-poster'
import { ProjectBriefAudioWaveform } from './project-brief-audio-waveform'

/** Fetches original media only while a playable mention preview is active. */
export function ProjectBriefActiveAssetPreview({
  assetId,
  resolution,
}: {
  /** Asset identity used for lazy signed-detail resolution. */
  assetId: string
  /** Current presentation-only resolution for the persisted mention. */
  resolution: ProjectMentionResolution
}) {
  const detail = useAssetDetailQuery(assetId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaUrl = detail.data?.url
  const type = resolution.asset?.type

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || type !== 'audio' || !mediaUrl)
      return
    void audio.play().catch(() => undefined)
    return () => {
      audio.pause()
      if (audio.readyState > 0)
        audio.currentTime = 0
    }
  }, [mediaUrl, type])

  if (type === 'video' && mediaUrl) {
    return (
      <video
        aria-hidden
        autoPlay
        className="size-full object-contain"
        draggable={false}
        loop
        muted
        playsInline
        poster={resolution.thumbnailUrl ?? undefined}
        preload="metadata"
        src={mediaUrl}
        tabIndex={-1}
        onCanPlay={(event) => {
          void event.currentTarget.play().catch(() => undefined)
        }}
      />
    )
  }

  if (type === 'audio') {
    return (
      <>
        {mediaUrl && (
          <audio
            aria-hidden
            preload="metadata"
            ref={audioRef}
            src={mediaUrl}
          />
        )}
        <ProjectBriefAudioWaveform active={Boolean(mediaUrl)} />
      </>
    )
  }

  return <ProjectBriefAssetPoster resolution={resolution} />
}
