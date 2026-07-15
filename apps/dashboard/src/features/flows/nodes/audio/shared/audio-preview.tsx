import type { AudioNodeState } from '@talelabs/flows'

import { useTranslation } from 'react-i18next'
import { AudioWaveformPreview } from './audio-waveform-preview'

export function AudioPreview({
  pending = false,
  previewUrl,
  readinessMessageKey,
  resolution,
}: {
  pending?: boolean
  previewUrl?: string
  readinessMessageKey: string
  resolution: AudioNodeState
}) {
  const { t } = useTranslation()
  return (
    <AudioWaveformPreview
      ariaLabel={t('flows.audio.preview.label')}
      pending={pending}
      previewUrl={previewUrl}
      readiness={resolution.readiness}
      readinessMessage={t(readinessMessageKey)}
      resolvedOperationId={resolution.resolvedOperationId}
    />
  )
}
