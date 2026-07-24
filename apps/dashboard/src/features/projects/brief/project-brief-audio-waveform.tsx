/** Decorative audio presentation for Project Brief Asset mentions. */

import { IconFileMusic } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'

const AUDIO_WAVEFORM_HEIGHTS = [
  34,
  58,
  82,
  46,
  72,
  38,
  90,
  54,
  66,
  42,
  76,
  50,
  86,
  36,
  64,
  44,
  80,
  56,
  70,
  40,
  88,
  52,
  74,
  32,
] as const

/** Renders a static or animated waveform without duplicating playback state. */
export function ProjectBriefAudioWaveform({
  active,
}: {
  /** Whether the associated audio preview is currently playing. */
  active: boolean
}) {
  return (
    <div className="
      flex size-full items-center justify-center gap-1.5 bg-muted/40 px-8
    "
    >
      <IconFileMusic
        aria-hidden
        className="mr-4 size-10 shrink-0 text-muted-foreground"
      />
      <div
        aria-hidden
        className="flex h-16 min-w-0 flex-1 items-center justify-center gap-1"
      >
        {AUDIO_WAVEFORM_HEIGHTS.map((height, index) => (
          <span
            className={cn(
              'w-1.5 shrink-0 rounded-full bg-muted-foreground/45',
              active && 'animate-pulse bg-primary/70',
            )}
            key={height}
            style={{
              animationDelay: `${index * 35}ms`,
              height: `${height}%`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
