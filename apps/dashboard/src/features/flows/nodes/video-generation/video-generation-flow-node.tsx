import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import { IconVideo } from '@tabler/icons-react'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from '../../flow-canvas-context'
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
  const canvas = useFlowCanvas()
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

  const effectiveReadiness = video.resolution.readiness === 'ready' || video.hasRunnablePlan
    ? 'ready'
    : video.resolution.readiness
  const readinessMessageKey = effectiveReadiness === 'ready'
    ? 'flows.video.readiness.ready'
    : video.resolution.issues.find(issue => issue.messageKey)?.messageKey
      ?? `flows.video.readiness.${effectiveReadiness}`
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
  const preview = canvas.getGenerationPreview(id)
  const previewUrl = preview
    && 'output' in preview
    && preview.output?.kind === 'media'
    && preview.output.mediaType === 'video'
    ? preview.output.download.content
    : undefined

  return (
    <GenerationNodeFrame
      icon={IconVideo}
      modelName={t(video.model.labelKey)}
      nodeId={id}
      outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
      outputHandleId="videos"
      outputLabel={outputLabel}
      outputValueType="VideoSet"
      readiness={effectiveReadiness}
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
          pending={preview?.status === 'pending'}
          previewUrl={previewUrl}
          readinessMessageKey={readinessMessageKey}
          resolution={{ ...video.resolution, readiness: effectiveReadiness }}
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
