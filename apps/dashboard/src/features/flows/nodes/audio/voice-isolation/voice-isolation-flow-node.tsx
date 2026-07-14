import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../flow-canvas-types'

import { IconFilter } from '@tabler/icons-react'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowNodeShell } from '../../flow-node-shell'
import { GenerationNodeFrame } from '../../generation-node-frame'
import { GenerationNodePreviewArea } from '../../generation-node-preview-area'
import { AudioInputRail } from '../shared/audio-input-rail'
import { AudioPreview } from '../shared/audio-preview'
import { useVoiceIsolationNode } from './use-voice-isolation-node'

export const VoiceIsolationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const isolation = useVoiceIsolationNode({
    incomingConnections,
    node: { data, id, type },
  })

  if (!isolation.model || !isolation.resolution) {
    return (
      <FlowNodeShell
        className="w-96"
        icon={IconFilter}
        nodeId={id}
        selected={selected}
        title={t('flows.nodes.voiceIsolation')}
      >
        <p className="text-sm text-destructive">
          {t('flows.modelUnavailable')}
        </p>
      </FlowNodeShell>
    )
  }

  const readinessMessageKey = isolation.resolution.issues.find(
    issue => issue.messageKey,
  )?.messageKey ?? `flows.audio.readiness.${isolation.resolution.readiness}`
  const outputLabel = t('flows.outputs.audio')

  return (
    <GenerationNodeFrame
      icon={IconFilter}
      modelName={t(isolation.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="audio"
      outputLabel={outputLabel}
      outputValueType="AudioSet"
      readiness={isolation.resolution.readiness}
      resolvedOperationId={isolation.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.voiceIsolation')}
    >
      <GenerationNodePreviewArea>
        <AudioInputRail
          ariaLabel={t('flows.audio.inputs.railLabel')}
          inputState={isolation.inputState}
          resolution={isolation.resolution}
          slots={isolation.slots}
        />
        <AudioPreview
          readinessMessageKey={readinessMessageKey}
          resolution={isolation.resolution}
        />
      </GenerationNodePreviewArea>
    </GenerationNodeFrame>
  )
})
