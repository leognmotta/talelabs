import { IconWaveSine } from '@tabler/icons-react'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'
import { GenerationPreviewStage } from '../../generation-preview-stage'

const WAVEFORM_HEIGHTS = [
  18,
  32,
  46,
  28,
  62,
  40,
  74,
  52,
  34,
  68,
  84,
  48,
  26,
  58,
  72,
  38,
  90,
  56,
  30,
  64,
  78,
  44,
  24,
  50,
] as const

export function AudioWaveformPreview({
  ariaLabel,
  pending = false,
  previewUrl,
  readiness,
  readinessMessage,
  resolvedOperationId,
}: {
  ariaLabel: string
  pending?: boolean
  previewUrl?: string
  readiness: 'incomplete' | 'invalid' | 'ready'
  readinessMessage: string
  resolvedOperationId: null | string
}) {
  const { t } = useTranslation()
  return (
    <GenerationPreviewStage
      aria-label={ariaLabel}
      data-audio-output-preview
      data-resolved-operation={resolvedOperationId ?? 'unresolved'}
      readiness={readiness}
      readinessMessage={readinessMessage}
      role="img"
      valueType="AudioSet"
    >
      <div className="absolute inset-0 flex items-center justify-center p-10">
        {previewUrl
          ? (
              <audio
                className="w-full max-w-80"
                controls
                preload="metadata"
                src={previewUrl}
              />
            )
          : (
              <div className="
                flex h-24 w-full items-center justify-center gap-1 rounded-xl
                border border-border/55 bg-card/35 px-6 shadow-inner
              "
              >
                {WAVEFORM_HEIGHTS.map(height => (
                  <span
                    className="w-1 rounded-full bg-muted-foreground/35"
                    key={height}
                    style={{ height: `${height}%` }}
                  />
                ))}
                <IconWaveSine
                  aria-hidden
                  className="absolute size-10 text-foreground/12"
                  stroke={1.25}
                />
              </div>
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
