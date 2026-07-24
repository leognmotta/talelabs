/** Poster-first Create result media with audio delegated to lazy playback. */

import type { FlowRunAssetOutput } from '@talelabs/sdk'

import { IconPhoto } from '@tabler/icons-react'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import { CreateAudioResult } from './create-audio-result'
import { CreateVideoResult } from './create-video-result'

/** Renders image/video posters or the media-specific compact audio row. */
export function CreateResultMedia({
  output,
  presentation = 'timeline',
  onOpenAsset,
}: {
  /** Opens the canonical Asset through the shared viewer. */
  onOpenAsset: (assetId: string) => void
  /** Bounded canonical output presentation from run history. */
  output: FlowRunAssetOutput
  /** Geometry selected by the active history presentation. */
  presentation?: 'grid' | 'timeline'
}) {
  const { t } = useTranslation()
  if (output.type === 'audio') {
    return (
      <CreateAudioResult output={output} presentation={presentation} />
    )
  }
  if (output.type === 'video') {
    return (
      <CreateVideoResult output={output} presentation={presentation} />
    )
  }
  return (
    <button
      aria-label={t('create.results.openAsset')}
      className={cn(
        `
          group relative flex w-full items-center justify-center overflow-hidden
          bg-muted/30 ring-1 ring-border/70 outline-none
          focus-visible:ring-2 focus-visible:ring-ring
        `,
        presentation === 'grid'
          ? 'aspect-4/3 rounded-xl'
          : 'min-h-48 rounded-2xl',
      )}
      type="button"
      onClick={() => onOpenAsset(output.assetId)}
    >
      {output.thumbnailUrl
        ? (
            <img
              alt={t('create.results.generatedMedia', {
                index: output.outputIndex + 1,
              })}
              className={cn(
                `
                  size-full transition-transform duration-200
                  group-hover:scale-[1.01]
                  motion-reduce:transition-none
                `,
                presentation === 'grid' ? 'object-cover' : 'object-contain',
              )}
              loading="lazy"
              src={output.thumbnailUrl}
            />
          )
        : <IconPhoto className="size-12 text-muted-foreground" />}
    </button>
  )
}
