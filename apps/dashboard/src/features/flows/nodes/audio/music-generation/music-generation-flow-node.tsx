import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../../flow-canvas-types'

import { IconMusic } from '@tabler/icons-react'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowNodeShell } from '../../flow-node-shell'
import { GenerationNodeFrame } from '../../generation-node-frame'
import { GenerationNodePreviewArea } from '../../generation-node-preview-area'
import { GenerationNodePromptSection } from '../../generation-node-prompt-section'
import { AudioInputRail } from '../shared/audio-input-rail'
import { AudioPreview } from '../shared/audio-preview'
import { AudioTextField } from '../shared/audio-text-field'
import { useMusicGenerationNode } from './use-music-generation-node'

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
  const readinessMessageKey = music.resolution.issues.find(
    issue => issue.messageKey,
  )?.messageKey ?? `flows.audio.readiness.${music.resolution.readiness}`
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
      readiness={music.resolution.readiness}
      resolvedOperationId={music.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.musicGeneration')}
    >
      <GenerationNodePreviewArea>
        <AudioInputRail
          ariaLabel={t('flows.audio.inputs.railLabel')}
          inputState={music.inputState}
          resolution={music.resolution}
          slots={music.slots}
        />
        <AudioPreview
          readinessMessageKey={readinessMessageKey}
          resolution={music.resolution}
        />
      </GenerationNodePreviewArea>
      <GenerationNodePromptSection>
        <div className="flex flex-col gap-3">
          <AudioTextField
            externalConnected={music.externalPromptConnected}
            externalHelp={t('flows.audio.prompt.externalAuthoritative')}
            helpId={`music-prompt-external-help-${id}`}
            input={textInput('prompt')}
            label={t('flows.audio.music.promptLabel')}
            placeholder={t('flows.audio.music.promptPlaceholder')}
            value={String(data.prompt ?? '')}
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
