import type { ImageGenerationState } from '@talelabs/flows'

import { IconPhotoSpark } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readAspectRatio } from '../flow-node-aspect-ratio'
import { GenerationPreviewStage } from '../generation-preview-stage'

export function ImageGenerationPreview({
  aspectRatio: aspectRatioSetting,
  previewUrl,
  readinessMessageKey,
  resolution,
}: {
  aspectRatio: unknown
  previewUrl?: string
  readinessMessageKey: string
  resolution: ImageGenerationState
}) {
  const { t } = useTranslation()
  const [measuredPreview, setMeasuredPreview] = useState<{
    aspectRatio: number
    url: string
  } | null>(null)
  const configuredAspectRatio = readAspectRatio(aspectRatioSetting) ?? 1
  const aspectRatio = previewUrl && measuredPreview?.url === previewUrl
    ? measuredPreview.aspectRatio
    : configuredAspectRatio
  const readinessMessage = t(readinessMessageKey)

  return (
    <GenerationPreviewStage
      aria-label={t('flows.image.preview.label')}
      aspectRatio={previewUrl ? aspectRatio : undefined}
      data-image-output-preview
      data-resolved-operation={resolution.resolvedOperationId ?? 'unresolved'}
      readiness={resolution.readiness}
      readinessMessage={readinessMessage}
      role="img"
      valueType="ImageSet"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {previewUrl
          ? (
              <img
                alt=""
                className="size-full object-cover"
                src={previewUrl}
                onLoad={(event) => {
                  const { naturalHeight, naturalWidth } = event.currentTarget
                  if (naturalWidth > 0 && naturalHeight > 0) {
                    setMeasuredPreview({
                      aspectRatio: naturalWidth / naturalHeight,
                      url: previewUrl,
                    })
                  }
                }}
              />
            )
          : (
              <IconPhotoSpark
                aria-hidden
                className="size-10 text-foreground/30"
                stroke={1.25}
              />
            )}
      </div>

      {/* TODO(provider-integration): Bind this production-shaped surface to mocked output ingestion only after canvas behavior approval. */}
    </GenerationPreviewStage>
  )
}
