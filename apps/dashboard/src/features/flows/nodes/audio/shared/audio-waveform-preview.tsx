import { IconWaveSine } from '@tabler/icons-react'
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
  readiness,
  readinessMessage,
  resolvedOperationId,
}: {
  ariaLabel: string
  readiness: 'incomplete' | 'invalid' | 'ready'
  readinessMessage: string
  resolvedOperationId: null | string
}) {
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
        <div className="
          flex h-24 w-full items-center justify-center gap-1 rounded-xl border
          border-border/55 bg-card/35 px-6 shadow-inner
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
      </div>
      {/* TODO(provider-integration): Bind this preview only after the shared mocked output-ingestion contract is approved. */}
    </GenerationPreviewStage>
  )
}
