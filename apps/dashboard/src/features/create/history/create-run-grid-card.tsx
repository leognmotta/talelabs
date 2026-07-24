/** Immersive media tile for one output or reserved Create run result. */

import type {
  FlowRunAssetOutput,
  FlowRunSummary,
  GenerationConfigResponse,
} from '@talelabs/sdk'
import type { Ref } from 'react'

import { IconPhotoOff } from '@tabler/icons-react'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useTranslation } from 'react-i18next'
import { useAssetDetailQuery } from '../../assets/data/asset-queries'
import { useVideoPreviewPlayback } from '../../assets/media/use-video-preview-playback'
import { CreateRunGridActions } from './create-run-grid-actions'
import { CreateRunGridMedia } from './create-run-grid-media'
import { createRunRequestTitle, createRunStatusKey } from './create-run-presentation'

/** Renders one visual grid cell while preserving access to its immutable request. */
export function CreateRunGridCard({
  articleRef,
  aspectRatio,
  generationConfig,
  output,
  primary,
  reserved,
  run,
  onCancel,
  onMakeVideo,
  onOpenAsset,
  onRetry,
  onReuseRequest,
  onUseAsReference,
}: {
  /** Optional ref used to reveal a newly admitted run. */
  articleRef?: Ref<HTMLElement>
  /** Persisted or request-derived source ratio reserved by the owning row. */
  aspectRatio: number
  /** Sanitized generation presentation catalog. */
  generationConfig: GenerationConfigResponse
  /** Canonical output represented by this card, when materialized. */
  output: FlowRunAssetOutput | null
  /** Whether this is the first grid card for the owning run. */
  primary: boolean
  /** Whether this card reserves space for an active output. */
  reserved: boolean
  /** Immutable run owning this grid item. */
  run: FlowRunSummary
  /** Requests durable cancellation through the ordinary run API. */
  onCancel: (run: FlowRunSummary) => void
  /** Composes an Image output as a Video start frame. */
  onMakeVideo: (output: FlowRunAssetOutput) => void
  /** Opens the existing shared Asset viewer. */
  onOpenAsset: (assetId: string) => void
  /** Admits a new retry from immutable historical state. */
  onRetry: (run: FlowRunSummary) => void
  /** Restores one immutable request into the current draft. */
  onReuseRequest: (run: FlowRunSummary) => void
  /** Explicitly attaches one prior result to the next request. */
  onUseAsReference: (output: FlowRunAssetOutput) => void
}) {
  const { t } = useTranslation()
  const title = createRunRequestTitle(run, generationConfig, t)
  const videoPreview = useVideoPreviewPlayback(output?.type === 'video')
  const videoAssetQuery = useAssetDetailQuery(
    output?.type === 'video' ? output.assetId : null,
    videoPreview.active,
  )

  return (
    <article
      aria-label={title}
      className="
        group relative isolate w-full min-w-0 scroll-mt-20 overflow-hidden
        rounded-lg bg-muted/20 ring-1 ring-border/60 transition-shadow
        focus-within:ring-2 focus-within:ring-ring
      "
      ref={articleRef}
      style={{ aspectRatio }}
      onBlur={videoPreview.onBlur}
      onFocus={videoPreview.onFocus}
      onMouseEnter={videoPreview.onMouseEnter}
      onMouseLeave={videoPreview.onMouseLeave}
    >
      {output
        ? (
            <div className="flex size-full items-center justify-center">
              <CreateRunGridMedia
                output={output}
                videoAsset={videoPreview.active
                  ? videoAssetQuery.data
                  : undefined}
                videoPreviewActive={videoPreview.active}
                videoRef={videoPreview.videoRef}
              />
            </div>
          )
        : reserved
          ? (
              <div className="
                relative flex size-full items-center justify-center
                overflow-hidden
              "
              >
                <Skeleton className="absolute inset-0 rounded-none opacity-35" />
                <p className="relative p-4 text-center text-sm font-medium">
                  {t(createRunStatusKey(run.status))}
                </p>
              </div>
            )
          : (
              <div className="
                flex size-full items-center justify-center p-5 text-center
              "
              >
                <div className="flex flex-col items-center gap-2">
                  <IconPhotoOff className="size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {t(createRunStatusKey(run.status))}
                  </p>
                  <p className="line-clamp-3 text-xs text-muted-foreground">
                    {run.errorMessage ?? t('create.history.noOutput')}
                  </p>
                </div>
              </div>
            )}
      <CreateRunGridActions
        output={output}
        primary={primary}
        run={run}
        onCancel={onCancel}
        onMakeVideo={onMakeVideo}
        onOpenAsset={onOpenAsset}
        onRetry={onRetry}
        onReuseRequest={onReuseRequest}
        onUseAsReference={onUseAsReference}
      />
    </article>
  )
}
