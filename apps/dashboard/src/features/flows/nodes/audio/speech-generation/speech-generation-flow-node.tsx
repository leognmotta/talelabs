import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../flow-canvas-types'

import { IconMicrophone } from '@tabler/icons-react'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from '../../../flow-canvas-context'
import { FlowNodeShell } from '../../flow-node-shell'
import { GenerationNodeFrame } from '../../generation-node-frame'
import { GenerationNodePreviewArea } from '../../generation-node-preview-area'
import { GenerationNodePromptSection } from '../../generation-node-prompt-section'
import { AudioPreview } from '../shared/audio-preview'
import { AudioTextField } from '../shared/audio-text-field'
import { useSpeechGenerationNode } from './use-speech-generation-node'

export const SpeechGenerationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const speech = useSpeechGenerationNode({
    incomingConnections,
    node: { data, id, type },
  })
  const preview = canvas.getGenerationPreview(id)
  const audioPreviewUrl = preview
    && 'output' in preview
    && preview.output?.kind === 'media'
    && preview.output.mediaType === 'audio'
    ? preview.output.download.content
    : undefined

  if (!speech.model || !speech.resolution) {
    return (
      <FlowNodeShell
        className="w-96"
        icon={IconMicrophone}
        nodeId={id}
        selected={selected}
        title={t('flows.nodes.speechGeneration')}
      >
        <p className="text-sm text-destructive">
          {t('flows.modelUnavailable')}
        </p>
      </FlowNodeShell>
    )
  }

  const promptSlot = speech.slots.find(slot => slot.id === 'prompt')
  const promptAvailability = promptSlot
    ? speech.resolution.inputAvailability.prompt
    : undefined
  const promptInput = promptSlot
    && promptAvailability
    && promptAvailability.state !== 'unsupported'
    ? {
        availability: promptAvailability,
        inputState: speech.inputState(promptSlot),
        slot: promptSlot,
      }
    : undefined
  const readinessMessageKey = speech.resolution.issues.find(
    issue => issue.messageKey,
  )?.messageKey ?? `flows.audio.readiness.${speech.resolution.readiness}`
  const outputLabel = t('flows.outputs.audio')

  return (
    <GenerationNodeFrame
      icon={IconMicrophone}
      modelName={t(speech.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="audio"
      outputLabel={outputLabel}
      outputValueType="AudioSet"
      readiness={speech.resolution.readiness}
      resolvedOperationId={speech.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.speechGeneration')}
    >
      <GenerationNodePreviewArea>
        <AudioPreview
          pending={preview?.status === 'pending'}
          previewUrl={audioPreviewUrl}
          readinessMessageKey={readinessMessageKey}
          resolution={speech.resolution}
        />
      </GenerationNodePreviewArea>
      <GenerationNodePromptSection>
        <AudioTextField
          externalConnected={speech.externalPromptConnected}
          externalHelp={t('flows.audio.prompt.externalAuthoritative')}
          helpId={`speech-script-external-help-${id}`}
          input={promptInput}
          label={t('flows.audio.speech.scriptLabel')}
          placeholder={t('flows.audio.speech.scriptPlaceholder')}
          value={String(data.prompt ?? '')}
          onValueChange={speech.updatePrompt}
        />
      </GenerationNodePromptSection>
    </GenerationNodeFrame>
  )
})
