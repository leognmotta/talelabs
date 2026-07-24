/** Poster-first lazy playback for one canonical Create video output. */

import type { FlowRunAssetOutput } from '@talelabs/sdk'

import { IconPlayerPlay, IconVideo } from '@tabler/icons-react'
import { Spinner } from '@talelabs/ui/components/spinner'
import { cn } from '@talelabs/ui/lib/utils'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAssetDetailQuery } from '../../assets/data/asset-queries'
import { AssetMediaPreview } from '../../assets/media/asset-media-preview'

/** Resolves and starts full video playback only after explicit user intent. */
export function CreateVideoResult({
  output,
  presentation = 'timeline',
}: {
  /** Bounded history output containing canonical identity and poster facts. */
  output: FlowRunAssetOutput
  /** Geometry selected by the active history presentation. */
  presentation?: 'grid' | 'timeline'
}) {
  const { t } = useTranslation()
  const [playbackRequested, setPlaybackRequested] = useState(false)
  const assetQuery = useAssetDetailQuery(output.assetId, playbackRequested)
  const asset = playbackRequested ? assetQuery.data : undefined
  const name = asset?.name ?? t('create.results.generatedMedia', {
    index: output.outputIndex + 1,
  })
  const frameClassName = presentation === 'grid'
    ? 'aspect-4/3 rounded-xl'
    : 'min-h-48 rounded-2xl'

  if (asset?.url) {
    return (
      <div className={cn(
        `
          flex w-full items-center justify-center overflow-hidden bg-black
          ring-1 ring-border/70
        `,
        frameClassName,
      )}
      >
        <AssetMediaPreview
          asset={asset}
          className="size-full object-contain"
          mode="player"
          videoAutoPlay
        />
      </div>
    )
  }

  return (
    <button
      aria-label={t('flows.nodeMedia.play', { name })}
      className={cn(
        `
          group relative flex w-full items-center justify-center overflow-hidden
          bg-muted/30 ring-1 ring-border/70 outline-none
          focus-visible:ring-2 focus-visible:ring-ring
          disabled:cursor-wait
        `,
        frameClassName,
      )}
      disabled={assetQuery.isFetching}
      type="button"
      onClick={() => {
        if (playbackRequested)
          void assetQuery.refetch()
        else
          setPlaybackRequested(true)
      }}
    >
      {output.thumbnailUrl
        ? (
            <img
              alt=""
              aria-hidden
              className="
                size-full object-cover transition-transform duration-200
                group-hover:scale-[1.01]
                motion-reduce:transition-none
              "
              draggable={false}
              loading="lazy"
              src={output.thumbnailUrl}
            />
          )
        : <IconVideo aria-hidden className="size-12 text-muted-foreground" />}
      <span className="
        absolute inset-0 flex items-center justify-center bg-black/15
        transition-colors
        group-hover:bg-black/25
      "
      >
        <span className="
          flex size-11 items-center justify-center rounded-full bg-black/65
          text-white shadow-sm ring-1 ring-white/15
        "
        >
          {assetQuery.isFetching
            ? <Spinner aria-label={t('common.loading')} />
            : <IconPlayerPlay aria-hidden className="size-5 fill-current" />}
        </span>
      </span>
    </button>
  )
}
