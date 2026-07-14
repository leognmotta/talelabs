import type { AudioNodeState } from '@talelabs/flows'

import { useTranslation } from 'react-i18next'
import { AudioWaveformPreview } from './audio-waveform-preview'

export function AudioPreview({
  readinessMessageKey,
  resolution,
}: {
  readinessMessageKey: string
  resolution: AudioNodeState
}) {
  const { t } = useTranslation()
  return (
    <AudioWaveformPreview
      ariaLabel={t('flows.audio.preview.label')}
      readiness={resolution.readiness}
      readinessMessage={t(readinessMessageKey)}
      resolvedOperationId={resolution.resolvedOperationId}
    />
  )
}
