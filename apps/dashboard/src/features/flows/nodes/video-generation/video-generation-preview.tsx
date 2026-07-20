/** Video output projection across retained preview, playback, and run states. */

import type { VideoGenerationState } from '@talelabs/flows'

import { IconVideo } from '@tabler/icons-react'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { GenerationPreviewEmptyState } from '../shared/generation-node/generation-preview-empty-state'
import { GenerationPreviewStage } from '../shared/generation-node/generation-preview-stage'

/** Displays the latest generated video, loading state, or empty output stage. */
export function VideoGenerationPreview({
  pending = false,
  previewUrl,
  readinessMessageKey,
  resolution,
}: {
  pending?: boolean
  previewUrl?: string
  readinessMessageKey: string
  resolution: VideoGenerationState
}) {
  const { t } = useTranslation()
  const readinessMessage = t(readinessMessageKey)

  return (
    <GenerationPreviewStage
      aria-label={t('flows.video.preview.label')}
      data-resolved-operation={resolution.resolvedOperationId ?? 'unresolved'}
      data-video-output-preview
      readiness={resolution.readiness}
      readinessMessage={readinessMessage}
      role="img"
      valueType="VideoSet"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {previewUrl
          ? (
              <video
                className="size-full object-cover"
                controls
                playsInline
                preload="metadata"
                src={previewUrl}
              />
            )
          : (
              <GenerationPreviewEmptyState
                icon={IconVideo}
                message={readinessMessage}
              />
            )}
      </div>
      {pending && (
        <div
          className="
            absolute inset-0 z-10 flex items-center justify-center
            bg-background/28 backdrop-blur-[1px]
          "
        >
          <Spinner aria-label={t('common.loading')} />
        </div>
      )}
    </GenerationPreviewStage>
  )
}
