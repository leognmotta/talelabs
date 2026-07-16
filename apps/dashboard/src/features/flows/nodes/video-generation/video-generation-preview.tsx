import type { VideoGenerationState } from '@talelabs/flows'

import { IconPlayerPlayFilled } from '@tabler/icons-react'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { GenerationPreviewStage } from '../generation-preview-stage'

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
              <span className="
                flex size-12 items-center justify-center rounded-full border
                border-border/75 bg-card/72 text-foreground/65 shadow-sm
                backdrop-blur-sm
              "
              >
                <IconPlayerPlayFilled aria-hidden className="ml-0.5 size-5" />
              </span>
            )}
      </div>
      {pending && previewUrl && (
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
