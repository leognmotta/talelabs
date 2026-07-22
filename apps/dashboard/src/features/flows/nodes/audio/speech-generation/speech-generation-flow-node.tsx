/** Memoized speech generation node driven by its own data and run preview. */

import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../editor/flow-canvas-types'

import { IconMicrophone } from '@tabler/icons-react'
import { coercePromptTemplate } from '@talelabs/flows'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowGenerationPreview } from '../../../editor/flow-canvas-runtime-context'
import { FlowNodeShell } from '../../shared/flow-node-shell'
import { GenerationNodeFrame } from '../../shared/generation-node/generation-node-frame'
import { GenerationNodePreviewArea } from '../../shared/generation-node/generation-node-preview-area'
import { GenerationNodePromptSection } from '../../shared/generation-node/generation-node-prompt-section'
import { AudioPreview } from '../shared/audio-preview'
import { AudioPromptField } from '../shared/audio-text-field'
import { useSpeechGenerationNode } from './use-speech-generation-node'

/** Memoized speech-generation projection keyed only by this node and its preview. */
export const SpeechGenerationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const preview = useFlowGenerationPreview(id)
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const speech = useSpeechGenerationNode({
    incomingConnections,
    node: { data, id, type },
  })
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
  const effectiveReadiness = speech.promptReferencesValid
    ? speech.resolution.readiness
    : 'invalid'
  const readinessMessageKey = speech.promptReferencesValid
    ? speech.resolution.issues.find(issue => issue.messageKey)?.messageKey
    ?? `flows.audio.readiness.${speech.resolution.readiness}`
    : 'flows.promptComposer.invalid'
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
      readiness={effectiveReadiness}
      resolvedOperationId={speech.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.speechGeneration')}
    >
      <GenerationNodePreviewArea nodeId={id}>
        <AudioPreview
          pending={preview?.status === 'pending'}
          previewUrl={audioPreviewUrl}
          readinessMessageKey={readinessMessageKey}
          resolution={{ ...speech.resolution, readiness: effectiveReadiness }}
        />
      </GenerationNodePreviewArea>
      <GenerationNodePromptSection>
        <AudioPromptField
          externalConnected={speech.externalPromptConnected}
          externalHelp={t('flows.audio.prompt.externalAuthoritative')}
          helpId={`speech-script-external-help-${id}`}
          input={promptInput}
          inputs={speech.promptInputs}
          label={t('flows.audio.speech.scriptLabel')}
          placeholder={t('flows.audio.speech.scriptPlaceholder')}
          value={coercePromptTemplate(data.prompt)}
          onValueChange={speech.updatePrompt}
        />
      </GenerationNodePromptSection>
    </GenerationNodeFrame>
  )
})
