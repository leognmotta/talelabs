import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import { IconVideo } from '@tabler/icons-react'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowNodeShell } from '../flow-node-shell'
import { GenerationNodeFrame } from '../generation-node-frame'
import { GenerationNodePreviewArea } from '../generation-node-preview-area'
import { GenerationNodePromptSection } from '../generation-node-prompt-section'
import { useVideoGenerationNode } from './use-video-generation-node'
import { VideoGenerationInputRail } from './video-generation-input-rail'
import { VideoGenerationPreview } from './video-generation-preview'
import { VideoGenerationPrompt } from './video-generation-prompt'

export const VideoGenerationFlowNode = memo(({
  data,
  id,
  selected,
  type,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const incomingConnections = useNodeConnections({ handleType: 'target', id })
  const node = { data, id, type }
  const video = useVideoGenerationNode({ incomingConnections, node })

  if (!video.model || !video.resolution) {
    return (
      <FlowNodeShell
        className="w-96"
        icon={IconVideo}
        nodeId={id}
        selected={selected}
        title={t('flows.nodes.videoGeneration')}
      >
        <p className="text-sm text-destructive">{t('flows.modelUnavailable')}</p>
      </FlowNodeShell>
    )
  }

  const readinessMessageKey = video.resolution.issues.find(issue => issue.messageKey)?.messageKey
    ?? `flows.video.readiness.${video.resolution.readiness}`
  const promptSlot = video.model.inputSlots.find(slot => slot.id === 'prompt')
  const promptAvailability = promptSlot
    ? video.resolution.inputAvailability[promptSlot.id]
    : undefined
  const promptInput = promptSlot
    && promptAvailability
    && promptAvailability.state !== 'unsupported'
    ? {
        availability: promptAvailability,
        inputState: video.inputState(promptSlot),
        slot: promptSlot,
      }
    : undefined

  const outputLabel = t('flows.outputs.videos')

  return (
    <GenerationNodeFrame
      icon={IconVideo}
      modelName={t(video.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="videos"
      outputLabel={outputLabel}
      outputValueType="VideoSet"
      readiness={video.resolution.readiness}
      resolvedOperationId={video.resolution.resolvedOperationId}
      selected={selected}
      title={t('flows.nodes.videoGeneration')}
    >
      <GenerationNodePreviewArea>
        <VideoGenerationInputRail
          ariaLabel={t('flows.video.inputs.railLabel')}
          inputState={video.inputState}
          resolution={video.resolution}
          slots={video.model.inputSlots}
        />
        <VideoGenerationPreview
          readinessMessageKey={readinessMessageKey}
          resolution={video.resolution}
        />
      </GenerationNodePreviewArea>
      <GenerationNodePromptSection>
        <VideoGenerationPrompt
          externalPromptConnected={video.externalPromptConnected}
          helpId={`video-prompt-external-help-${id}`}
          input={promptInput}
          prompt={String(data.prompt ?? '')}
          onPromptChange={video.updatePrompt}
        />
      </GenerationNodePromptSection>
    </GenerationNodeFrame>
  )
})
