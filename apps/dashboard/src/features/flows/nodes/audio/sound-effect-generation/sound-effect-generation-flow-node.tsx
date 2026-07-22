/** Sound-effect node composition for prompt, settings, and generated audio output. */

import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../editor/flow-canvas-types'

import { IconSparkles } from '@tabler/icons-react'
import { coercePromptTemplate } from '@talelabs/flows'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowNodeShell } from '../../shared/flow-node-shell'
import { GenerationNodeFrame } from '../../shared/generation-node/generation-node-frame'
import { GenerationNodePreviewArea } from '../../shared/generation-node/generation-node-preview-area'
import { GenerationNodePromptSection } from '../../shared/generation-node/generation-node-prompt-section'
import { AudioPreview } from '../shared/audio-preview'
import { AudioPromptField } from '../shared/audio-text-field'
import { useSoundEffectGenerationNode } from './use-sound-effect-generation-node'

/** Composes prompt input, adaptive settings, output preview, and run controls. */
export const SoundEffectGenerationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const soundEffect = useSoundEffectGenerationNode({
    incomingConnections,
    node: { data, id, type },
  })

  if (!soundEffect.model || !soundEffect.resolution) {
    return (
      <FlowNodeShell
        className="w-96"
        icon={IconSparkles}
        nodeId={id}
        selected={selected}
        title={t('flows.nodes.soundEffectGeneration')}
      >
        <p className="text-sm text-destructive">
          {t('flows.modelUnavailable')}
        </p>
      </FlowNodeShell>
    )
  }

  const promptSlot = soundEffect.slots.find(slot => slot.id === 'prompt')
  const promptAvailability = promptSlot
    ? soundEffect.resolution.inputAvailability.prompt
    : undefined
  const promptInput = promptSlot
    && promptAvailability
    && promptAvailability.state !== 'unsupported'
    ? {
        availability: promptAvailability,
        inputState: soundEffect.inputState(promptSlot),
        slot: promptSlot,
      }
    : undefined
  const effectiveReadiness = soundEffect.promptReferencesValid
    ? soundEffect.resolution.readiness
    : 'invalid'
  const readinessMessageKey = soundEffect.promptReferencesValid
    ? soundEffect.resolution.issues.find(issue => issue.messageKey)?.messageKey
    ?? `flows.audio.readiness.${soundEffect.resolution.readiness}`
    : 'flows.promptComposer.invalid'
  const outputLabel = t('flows.outputs.audio')

  return (
    <GenerationNodeFrame
      icon={IconSparkles}
      modelName={t(soundEffect.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="audio"
      outputLabel={outputLabel}
      outputValueType="AudioSet"
      readiness={effectiveReadiness}
      resolvedOperationId={soundEffect.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.soundEffectGeneration')}
    >
      <GenerationNodePreviewArea nodeId={id}>
        <AudioPreview
          nodeId={id}
          readinessMessageKey={readinessMessageKey}
          resolution={{ ...soundEffect.resolution, readiness: effectiveReadiness }}
        />
      </GenerationNodePreviewArea>
      <GenerationNodePromptSection>
        <AudioPromptField
          externalConnected={soundEffect.externalPromptConnected}
          externalHelp={t('flows.audio.prompt.externalAuthoritative')}
          helpId={`sound-effect-prompt-external-help-${id}`}
          input={promptInput}
          inputs={soundEffect.promptInputs}
          label={t('flows.audio.soundEffect.promptLabel')}
          placeholder={t('flows.audio.soundEffect.promptPlaceholder')}
          value={coercePromptTemplate(data.prompt)}
          onValueChange={soundEffect.updatePrompt}
        />
      </GenerationNodePromptSection>
    </GenerationNodeFrame>
  )
})
