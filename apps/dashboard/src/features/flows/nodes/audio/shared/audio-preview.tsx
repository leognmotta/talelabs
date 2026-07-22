/** Shared live audio preview binding for every audio-intent Flow node. */

import type { AudioNodeState } from '@talelabs/flows'

import { useTranslation } from 'react-i18next'
import { useFlowGenerationPreview } from '../../../editor/flow-canvas-runtime-context'
import { AudioWaveformPreview } from './audio-waveform-preview'

/** Resolves the current node run output into shared audio playback presentation. */
export function AudioPreview({
  nodeId,
  readinessMessageKey,
  resolution,
}: {
  nodeId: string
  readinessMessageKey: string
  resolution: AudioNodeState
}) {
  const { t } = useTranslation()
  const preview = useFlowGenerationPreview(nodeId)
  const previewUrl = preview
    && 'output' in preview
    && preview.output?.kind === 'media'
    && preview.output.mediaType === 'audio'
    ? preview.output.download.content
    : undefined

  return (
    <AudioWaveformPreview
      ariaLabel={t('flows.audio.preview.label')}
      pending={preview?.status === 'pending'}
      previewUrl={previewUrl}
      readiness={resolution.readiness}
      readinessMessage={t(readinessMessageKey)}
      resolvedOperationId={resolution.resolvedOperationId}
    />
  )
}
