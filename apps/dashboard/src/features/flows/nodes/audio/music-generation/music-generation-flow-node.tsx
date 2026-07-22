/** Music-generation node composition for lyrics, prompt, settings, and audio output. */

import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../editor/flow-canvas-types'

import { IconMusic } from '@tabler/icons-react'
import { coercePromptTemplate } from '@talelabs/flows'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowNodeShell } from '../../shared/flow-node-shell'
import { GenerationNodeFrame } from '../../shared/generation-node/generation-node-frame'
import { GenerationNodePreviewArea } from '../../shared/generation-node/generation-node-preview-area'
import { GenerationNodePromptSection } from '../../shared/generation-node/generation-node-prompt-section'
import { AudioInputRail } from '../shared/audio-input-rail'
import { AudioPreview } from '../shared/audio-preview'
import { AudioPromptField, AudioTextField } from '../shared/audio-text-field'
import { useMusicGenerationNode } from './use-music-generation-node'

/** Composes lyric/prompt inputs, adaptive settings, output preview, and run controls. */
export const MusicGenerationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const music = useMusicGenerationNode({
    incomingConnections,
    node: { data, id, type },
  })

  if (!music.model || !music.resolution) {
    return (
      <FlowNodeShell
        className="w-96"
        icon={IconMusic}
        nodeId={id}
        selected={selected}
        title={t('flows.nodes.musicGeneration')}
      >
        <p className="text-sm text-destructive">
          {t('flows.modelUnavailable')}
        </p>
      </FlowNodeShell>
    )
  }

  function textInput(slotId: 'lyrics' | 'prompt') {
    const slot = music.slots.find(candidate => candidate.id === slotId)
    const availability = music.resolution?.inputAvailability[slotId]
    return slot && availability && availability.state !== 'unsupported'
      ? {
          availability,
          inputState: music.inputState(slot),
          slot,
        }
      : undefined
  }

  const lyricsInput = textInput('lyrics')
  const effectiveReadiness = music.promptReferencesValid
    ? music.resolution.readiness
    : 'invalid'
  const readinessMessageKey = music.promptReferencesValid
    ? music.resolution.issues.find(issue => issue.messageKey)?.messageKey
    ?? `flows.audio.readiness.${music.resolution.readiness}`
    : 'flows.promptComposer.invalid'
  const outputLabel = t('flows.outputs.audio')

  return (
    <GenerationNodeFrame
      icon={IconMusic}
      modelName={t(music.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="audio"
      outputLabel={outputLabel}
      outputValueType="AudioSet"
      readiness={effectiveReadiness}
      resolvedOperationId={music.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.musicGeneration')}
    >
      <GenerationNodePreviewArea nodeId={id}>
        <AudioInputRail
          ariaLabel={t('flows.audio.inputs.railLabel')}
          inputState={music.inputState}
          resolution={{ ...music.resolution, readiness: effectiveReadiness }}
          slots={music.slots}
        />
        <AudioPreview
          readinessMessageKey={readinessMessageKey}
          resolution={music.resolution}
        />
      </GenerationNodePreviewArea>
      <GenerationNodePromptSection>
        <div className="flex flex-col gap-3">
          <AudioPromptField
            externalConnected={music.externalPromptConnected}
            externalHelp={t('flows.audio.prompt.externalAuthoritative')}
            helpId={`music-prompt-external-help-${id}`}
            input={textInput('prompt')}
            inputs={music.promptInputs}
            label={t('flows.audio.music.promptLabel')}
            placeholder={t('flows.audio.music.promptPlaceholder')}
            value={coercePromptTemplate(data.prompt)}
            onValueChange={music.updatePrompt}
          />
          {lyricsInput && (
            <AudioTextField
              externalConnected={music.externalLyricsConnected}
              externalHelp={t('flows.audio.lyrics.externalAuthoritative')}
              helpId={`music-lyrics-external-help-${id}`}
              input={lyricsInput}
              label={t('flows.audio.music.lyricsLabel')}
              placeholder={t('flows.audio.music.lyricsPlaceholder')}
              value={String(data.lyrics ?? '')}
              onValueChange={music.updateLyrics}
            />
          )}
        </div>
      </GenerationNodePromptSection>
    </GenerationNodeFrame>
  )
})
