/** Voice-change node composition for source audio, settings, and transformed output. */

import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../editor/flow-canvas-types'

import { IconArrowsExchange } from '@tabler/icons-react'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowNodeShell } from '../../shared/flow-node-shell'
import { GenerationNodeFrame } from '../../shared/generation-node/generation-node-frame'
import { GenerationNodePreviewArea } from '../../shared/generation-node/generation-node-preview-area'
import { AudioInputRail } from '../shared/audio-input-rail'
import { AudioPreview } from '../shared/audio-preview'
import { useVoiceChangerNode } from './use-voice-changer-node'

/** Composes the voice-change input, adaptive settings, preview, and run controls. */
export const VoiceChangerFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const voiceChanger = useVoiceChangerNode({
    incomingConnections,
    node: { data, id, type },
  })

  if (!voiceChanger.model || !voiceChanger.resolution) {
    return (
      <FlowNodeShell
        className="w-96"
        icon={IconArrowsExchange}
        nodeId={id}
        selected={selected}
        title={t('flows.nodes.voiceChanger')}
      >
        <p className="text-sm text-destructive">
          {t('flows.modelUnavailable')}
        </p>
      </FlowNodeShell>
    )
  }

  const readinessMessageKey = voiceChanger.resolution.issues.find(
    issue => issue.messageKey,
  )?.messageKey ?? `flows.audio.readiness.${voiceChanger.resolution.readiness}`
  const outputLabel = t('flows.outputs.audio')

  return (
    <GenerationNodeFrame
      icon={IconArrowsExchange}
      modelName={t(voiceChanger.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="audio"
      outputLabel={outputLabel}
      outputValueType="AudioSet"
      readiness={voiceChanger.resolution.readiness}
      resolvedOperationId={voiceChanger.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.voiceChanger')}
    >
      <GenerationNodePreviewArea>
        <AudioInputRail
          ariaLabel={t('flows.audio.inputs.railLabel')}
          inputState={voiceChanger.inputState}
          resolution={voiceChanger.resolution}
          slots={voiceChanger.slots}
        />
        <AudioPreview
          readinessMessageKey={readinessMessageKey}
          resolution={voiceChanger.resolution}
        />
      </GenerationNodePreviewArea>
    </GenerationNodeFrame>
  )
})
