import type { FlowImageCrop, ImageGenerationState } from '@talelabs/flows'

import { IconPhotoSpark } from '@tabler/icons-react'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { imageCropAspectRatio } from '../../image-crop'
import { CroppedImagePreview } from '../../image-crop-editor'
import { readAspectRatio } from '../flow-node-aspect-ratio'
import { GenerationPreviewStage } from '../generation-preview-stage'

export function ImageGenerationPreview({
  aspectRatio: aspectRatioSetting,
  pending = false,
  previewUrl,
  readinessMessageKey,
  resolution,
  savedCrop,
}: {
  aspectRatio: unknown
  pending?: boolean
  previewUrl?: string
  readinessMessageKey: string
  resolution: ImageGenerationState
  savedCrop?: FlowImageCrop | null
}) {
  const { t } = useTranslation()
  const [measuredPreview, setMeasuredPreview] = useState<{
    aspectRatio: number
    height: number
    url: string
    width: number
  } | null>(null)
  const configuredAspectRatio = readAspectRatio(aspectRatioSetting) ?? 1
  const sourceAspectRatio = previewUrl && measuredPreview?.url === previewUrl
    ? measuredPreview.aspectRatio
    : null
  const measuredSource = previewUrl && measuredPreview?.url === previewUrl
    ? measuredPreview
    : null
  const aspectRatio = savedCrop
    ? imageCropAspectRatio(
        savedCrop,
        measuredSource?.width ?? null,
        measuredSource?.height ?? null,
      )
    : sourceAspectRatio ?? configuredAspectRatio
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
              savedCrop
                ? (
                    <CroppedImagePreview
                      alt=""
                      crop={savedCrop}
                      frameAspectRatio={aspectRatio}
                      sourceHeight={measuredPreview?.url === previewUrl
                        ? measuredPreview.height
                        : null}
                      sourceWidth={measuredPreview?.url === previewUrl
                        ? measuredPreview.width
                        : null}
                      src={previewUrl}
                      onSourceAspectRatioChange={(nextAspectRatio) => {
                        if (Number.isFinite(nextAspectRatio) && nextAspectRatio > 0) {
                          setMeasuredPreview(current => current?.url === previewUrl
                            ? current
                            : {
                                aspectRatio: nextAspectRatio,
                                height: 1,
                                url: previewUrl,
                                width: nextAspectRatio,
                              })
                        }
                      }}
                    />
                  )
                : (
                    <img
                      alt=""
                      className="size-full object-cover"
                      src={previewUrl}
                      onLoad={(event) => {
                        const { naturalHeight, naturalWidth } = event.currentTarget
                        if (naturalWidth > 0 && naturalHeight > 0) {
                          setMeasuredPreview({
                            aspectRatio: naturalWidth / naturalHeight,
                            height: naturalHeight,
                            url: previewUrl,
                            width: naturalWidth,
                          })
                        }
                      }}
                    />
                  )
            )
          : (
              <IconPhotoSpark
                aria-hidden
                className="size-10 text-foreground/30"
                stroke={1.25}
              />
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
