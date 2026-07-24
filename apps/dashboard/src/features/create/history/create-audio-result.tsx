/** Compact lazy playback row for one canonical Create audio output. */

import type { FlowRunAssetOutput } from '@talelabs/sdk'

import { IconFileMusic, IconPlayerPlay } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAssetDetailQuery } from '../../assets/data/asset-queries'
import { formatDuration } from '../../assets/media/asset-formatters'

const WAVEFORM_BARS = [
  { height: 30, id: 'intro-1' },
  { height: 58, id: 'intro-2' },
  { height: 82, id: 'intro-3' },
  { height: 46, id: 'intro-4' },
  { height: 72, id: 'rise-1' },
  { height: 38, id: 'rise-2' },
  { height: 90, id: 'rise-3' },
  { height: 54, id: 'rise-4' },
  { height: 34, id: 'fall-1' },
  { height: 68, id: 'fall-2' },
  { height: 44, id: 'fall-3' },
  { height: 76, id: 'fall-4' },
  { height: 28, id: 'outro-1' },
  { height: 62, id: 'outro-2' },
  { height: 84, id: 'outro-3' },
  { height: 48, id: 'outro-4' },
] as const

/** Resolves full playback data only after the user explicitly requests audio. */
export function CreateAudioResult({
  output,
  presentation = 'timeline',
}: {
  /** Bounded history output containing only canonical identity and poster facts. */
  output: FlowRunAssetOutput
  /** Geometry selected by the active history presentation. */
  presentation?: 'grid' | 'timeline'
}) {
  const { t } = useTranslation()
  const [playbackRequested, setPlaybackRequested] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const assetQuery = useAssetDetailQuery(output.assetId, playbackRequested)
  const asset = playbackRequested ? assetQuery.data : undefined
  const fallbackName = t('create.results.generatedMedia', {
    index: output.outputIndex + 1,
  })
  const name = asset?.name ?? fallbackName
  const duration = asset ? formatDuration(asset.durationSeconds) : null

  useEffect(() => {
    if (!asset?.url || !playbackRequested)
      return

    void audioRef.current?.play().catch(() => undefined)
  }, [asset?.url, playbackRequested])

  if (presentation === 'grid') {
    return (
      <div className="
        relative flex size-full items-center justify-center overflow-hidden
        bg-muted/25 p-6
      "
      >
        <div className="
          absolute top-4 left-4 flex size-10 items-center justify-center
          rounded-lg bg-background/45 ring-1 ring-border/60
        "
        >
          <IconFileMusic
            aria-hidden
            className="size-5 text-muted-foreground"
          />
        </div>
        {asset?.url
          ? (
              <audio
                aria-label={name}
                className="h-10 w-full max-w-2xl"
                controls
                preload="metadata"
                ref={audioRef}
                src={asset.url}
              />
            )
          : (
              <div className="
                flex w-full max-w-2xl items-center justify-center gap-4
              "
              >
                <Button
                  aria-label={t('flows.nodeMedia.play', { name })}
                  disabled={assetQuery.isFetching}
                  size="icon-sm"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (playbackRequested)
                      void assetQuery.refetch()
                    else setPlaybackRequested(true)
                  }}
                >
                  {assetQuery.isFetching
                    ? <Spinner />
                    : <IconPlayerPlay aria-hidden />}
                </Button>
                <div
                  aria-hidden
                  className="
                    flex h-11 min-w-0 flex-1 items-center justify-center gap-1
                    overflow-hidden
                  "
                >
                  {WAVEFORM_BARS.map(bar => (
                    <span
                      className="
                        w-1.5 shrink-0 rounded-full bg-muted-foreground/40
                      "
                      key={bar.id}
                      style={{ height: `${bar.height}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
      </div>
    )
  }

  return (
    <div className="
      flex min-h-28 w-full items-center gap-4 rounded-2xl bg-muted/25 p-4 ring-1
      ring-border/70
    "
    >
      <div className="
        flex size-12 shrink-0 items-center justify-center rounded-xl
        bg-background/45 ring-1 ring-border/60
      "
      >
        <IconFileMusic aria-hidden className="size-6 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium" title={name}>{name}</p>
          {duration && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {duration}
            </span>
          )}
        </div>
        {asset?.url
          ? (
              <audio
                aria-label={name}
                className="h-9 w-full"
                controls
                preload="metadata"
                ref={audioRef}
                src={asset.url}
              />
            )
          : (
              <div className="flex items-center gap-3">
                <Button
                  aria-label={t('flows.nodeMedia.play', { name })}
                  disabled={assetQuery.isFetching}
                  size="icon-sm"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (playbackRequested)
                      void assetQuery.refetch()
                    else setPlaybackRequested(true)
                  }}
                >
                  {assetQuery.isFetching
                    ? <Spinner />
                    : <IconPlayerPlay aria-hidden />}
                </Button>
                <div
                  aria-hidden
                  className="
                    flex h-8 min-w-0 flex-1 items-center gap-1 overflow-hidden
                  "
                >
                  {WAVEFORM_BARS.map(bar => (
                    <span
                      className="
                        w-1 shrink-0 rounded-full bg-muted-foreground/35
                      "
                      key={bar.id}
                      style={{ height: `${bar.height}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
      </div>
    </div>
  )
}
