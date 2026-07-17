/** Memoized image generation node with keyed preview and crop state. */

import type { NodeProps } from '@xyflow/react'
import type { CanvasNode } from '../../flow-canvas-types'

import { IconPhotoSpark } from '@tabler/icons-react'
import { normalizeImageGenerationInputSlotId } from '@talelabs/flows'
import { useNodeConnections } from '@xyflow/react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStore } from '../../canvas-state/canvas-store-context'
import { useFlowGenerationPreview } from '../../flow-canvas-runtime-context'
import { readImageCrop } from '../../image-crop'
import { FlowNodeShell } from '../flow-node-shell'
import { GenerationNodeFrame } from '../generation-node-frame'
import { GenerationNodePreviewArea } from '../generation-node-preview-area'
import { GenerationNodePromptSection } from '../generation-node-prompt-section'
import { ImageGenerationCropMode } from './image-generation-crop-mode'
import { ImageGenerationInputRail } from './image-generation-input-rail'
import { ImageGenerationPreview } from './image-generation-preview'
import { ImageGenerationPrompt } from './image-generation-prompt'
import { useImageGenerationNode } from './use-image-generation-node'

/** Renders one memoized image generation node and its keyed preview. */
export const ImageGenerationFlowNode = memo(
  ({ data, id, selected, type }: NodeProps<CanvasNode>) => {
    const { t } = useTranslation()
    const preview = useFlowGenerationPreview(id)
    const editingCrop = useCanvasStore(
      state => state.editingImageCropNodeId === id,
    )
    const incomingConnections = useNodeConnections({
      handleType: 'target',
      id,
    })
    const node = { data, id, type }
    const image = useImageGenerationNode({ incomingConnections, node })

    if (!image.model || !image.resolution) {
      return (
        <FlowNodeShell
          className="w-96"
          icon={IconPhotoSpark}
          nodeId={id}
          selected={selected}
          title={t('flows.nodes.imageGeneration')}
        >
          <p className="text-sm text-destructive">
            {t('flows.modelUnavailable')}
          </p>
        </FlowNodeShell>
      )
    }

    const readinessMessageKey
      = image.resolution.issues.find(issue => issue.messageKey)?.messageKey
        ?? `flows.image.readiness.${image.resolution.readiness}`
    const promptSlot = image.semanticSlots.find(slot => slot.id === 'prompt')
    const promptAvailability = promptSlot
      ? image.resolution.inputAvailability[
        normalizeImageGenerationInputSlotId(promptSlot.id)
      ]
      : undefined
    const promptInput
      = promptSlot
        && promptAvailability
        && promptAvailability.state !== 'unsupported'
        ? {
            availability: promptAvailability,
            inputState: image.inputState(promptSlot),
            slot: promptSlot,
          }
        : undefined

    const outputLabel = t('flows.outputs.images')
    const previewUrl = preview
      && 'output' in preview
      && preview.output?.kind === 'media'
      ? preview.output.download.content
      : undefined
    const savedCrop = readImageCrop(data.crop)

    return (
      <GenerationNodeFrame
        icon={IconPhotoSpark}
        modelName={t(image.model.labelKey)}
        nodeId={id}
        outputAriaLabel={t('flows.handles.output', { output: outputLabel })}
        outputHandleId="images"
        outputLabel={outputLabel}
        outputValueType="ImageSet"
        readiness={image.resolution.readiness}
        resolvedOperationId={image.resolution.resolvedOperationId}
        selected={selected}
        title={t('flows.nodes.imageGeneration')}
      >
        <GenerationNodePreviewArea>
          <ImageGenerationInputRail
            ariaLabel={t('flows.image.inputs.railLabel')}
            inputState={image.inputState}
            resolution={image.resolution}
            slots={image.semanticSlots}
          />
          {editingCrop && previewUrl
            ? (
                <ImageGenerationCropMode
                  nodeId={id}
                  savedCrop={savedCrop}
                  src={previewUrl}
                />
              )
            : (
                <ImageGenerationPreview
                  aspectRatio={image.resolution.normalizedSettings.aspectRatio}
                  pending={preview?.status === 'pending'}
                  previewUrl={previewUrl}
                  readinessMessageKey={readinessMessageKey}
                  resolution={image.resolution}
                  savedCrop={savedCrop}
                />
              )}
        </GenerationNodePreviewArea>
        <GenerationNodePromptSection>
          <ImageGenerationPrompt
            externalPromptConnected={image.externalPromptConnected}
            helpId={`image-prompt-external-help-${id}`}
            input={promptInput}
            prompt={String(data.prompt ?? '')}
            onPromptChange={image.updatePrompt}
          />
        </GenerationNodePromptSection>
      </GenerationNodeFrame>
    )
  },
)
