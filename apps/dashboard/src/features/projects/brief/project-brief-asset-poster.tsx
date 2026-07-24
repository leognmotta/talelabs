/** Static media poster for an available Project Brief Asset mention. */

import type { ProjectMentionResolution } from '@talelabs/sdk'

import { IconPhoto, IconVideo } from '@tabler/icons-react'

import { ProjectBriefAudioWaveform } from './project-brief-audio-waveform'

/** Renders an Asset thumbnail or a media-type fallback without fetching media. */
export function ProjectBriefAssetPoster({
  resolution,
}: {
  /** Current presentation-only resolution for the persisted mention. */
  resolution: ProjectMentionResolution
}) {
  if (resolution.thumbnailUrl) {
    return (
      <img
        alt=""
        aria-hidden
        className="size-full object-contain"
        draggable={false}
        loading="lazy"
        src={resolution.thumbnailUrl}
      />
    )
  }

  if (resolution.asset?.type === 'audio')
    return <ProjectBriefAudioWaveform active={false} />

  const Icon = resolution.asset?.type === 'video'
    ? IconVideo
    : IconPhoto

  return (
    <div className="flex size-full items-center justify-center bg-muted/40">
      <Icon aria-hidden className="size-12 text-muted-foreground" />
    </div>
  )
}
