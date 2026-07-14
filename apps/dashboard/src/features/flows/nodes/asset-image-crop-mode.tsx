import type { FlowImageCrop } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import { NodeToolbar, Position } from '@xyflow/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlowActionTooltip } from '../flow-action-tooltip'
import { useFlowCanvas } from '../flow-canvas-context'
import {
  FULL_IMAGE_CROP,
  imageCropAspectRatio,
  imageNodeDisplayAspectRatio,
  isFullImageCrop,
} from '../image-crop'
import { ImageCropEditor } from '../image-crop-editor'

export function AssetImageCropMode({
  asset,
  nodeId,
  savedCrop,
  src,
}: {
  asset: FlowReferenceAsset
  nodeId: string
  savedCrop: FlowImageCrop | null
  src: string
}) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const [draftCrop, setDraftCrop] = useState<FlowImageCrop>(
    savedCrop ?? FULL_IMAGE_CROP,
  )
  const editorAspectRatio = imageNodeDisplayAspectRatio(
    imageCropAspectRatio(
      savedCrop ?? FULL_IMAGE_CROP,
      asset.width,
      asset.height,
    ),
  )

  function applyCrop() {
    canvas.updateNodeData(nodeId, (current) => {
      if (!isFullImageCrop(draftCrop))
        return { ...current, crop: draftCrop }
      const { crop: _crop, ...withoutCrop } = current
      return withoutCrop
    })
    canvas.setEditingImageCropNodeId(null)
  }

  return (
    <>
      <NodeToolbar
        className="
          nodrag nopan flex items-center gap-1 rounded-xl border
          border-border/90 bg-card/96 p-1 shadow-xl backdrop-blur-sm
        "
        isVisible
        nodeId={nodeId}
        offset={10}
        position={Position.Bottom}
      >
        <FlowActionTooltip
          disabled={isFullImageCrop(draftCrop)}
          label={t('flows.cropEditor.reset')}
        >
          <Button
            disabled={isFullImageCrop(draftCrop)}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setDraftCrop(FULL_IMAGE_CROP)}
          >
            {t('flows.cropEditor.reset')}
          </Button>
        </FlowActionTooltip>
        <Separator className="mx-0.5 h-5! self-center!" orientation="vertical" />
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => canvas.setEditingImageCropNodeId(null)}
        >
          {t('common.cancel')}
        </Button>
        <Button size="sm" type="button" onClick={applyCrop}>
          {t('flows.cropEditor.apply')}
        </Button>
      </NodeToolbar>
      <ImageCropEditor
        alt={asset.name}
        crop={draftCrop}
        frameAspectRatio={editorAspectRatio}
        sourceHeight={asset.height}
        sourceWidth={asset.width}
        src={src}
        onCropChange={setDraftCrop}
      />
    </>
  )
}
