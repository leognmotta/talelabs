import type { FlowImageCrop } from '@talelabs/flows'

import { useEffect, useState } from 'react'
import { useFlowCanvas } from '../../flow-canvas-context'
import {
  FULL_IMAGE_CROP,
  imageCropAspectRatio,
  imageNodeDisplayAspectRatio,
  isFullImageCrop,
} from '../../image-crop'
import { ImageCropEditor } from '../../image-crop-editor'
import { ImageCropToolbar } from '../../image-crop-toolbar'

export function ImageGenerationCropMode({
  nodeId,
  savedCrop,
  src,
}: {
  nodeId: string
  savedCrop: FlowImageCrop | null
  src: string
}) {
  const canvas = useFlowCanvas()
  const [draftCrop, setDraftCrop] = useState<FlowImageCrop>(
    savedCrop ?? FULL_IMAGE_CROP,
  )
  const [sourceSize, setSourceSize] = useState<{
    height: number
    width: number
  } | null>(null)

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setSourceSize({
          height: image.naturalHeight,
          width: image.naturalWidth,
        })
      }
    }
    image.src = src
  }, [src])

  const editorAspectRatio = imageNodeDisplayAspectRatio(
    imageCropAspectRatio(
      savedCrop ?? FULL_IMAGE_CROP,
      sourceSize?.width ?? null,
      sourceSize?.height ?? null,
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
      <ImageCropToolbar
        draftCrop={draftCrop}
        nodeId={nodeId}
        onApply={applyCrop}
        onCancel={() => canvas.setEditingImageCropNodeId(null)}
        onReset={() => setDraftCrop(FULL_IMAGE_CROP)}
      />
      <ImageCropEditor
        alt=""
        crop={draftCrop}
        frameAspectRatio={editorAspectRatio}
        sourceHeight={sourceSize?.height ?? null}
        sourceWidth={sourceSize?.width ?? null}
        src={src}
        onCropChange={setDraftCrop}
      />
    </>
  )
}
