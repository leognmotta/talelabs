/** Generation-output crop editor that commits node crop data on apply. */

import type { FlowImageCrop } from '@talelabs/flows'

import { useEffect, useState } from 'react'
import { updateCanvasNodeData } from '../../editor/canvas-state/canvas-node-actions'
import { useCanvasStoreApi } from '../../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../../editor/flow-canvas-runtime-context'
import {
  FULL_IMAGE_CROP,
  isFullImageCrop,
} from '../shared/media/image-crop'
import { ImageCropEditor } from '../shared/media/image-crop-editor'
import {
  imageCropAspectRatio,
  imageNodeDisplayAspectRatio,
} from '../shared/media/image-crop-geometry'
import { ImageCropToolbar } from '../shared/media/image-crop-toolbar'

/** Edits and applies crop metadata for one generated image preview. */
export function ImageGenerationCropMode({
  nodeId,
  savedCrop,
  src,
}: {
  nodeId: string
  savedCrop: FlowImageCrop | null
  src: string
}) {
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
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
    updateCanvasNodeData({
      referenceData: runtime.referenceData,
      store,
    }, nodeId, (current) => {
      if (!isFullImageCrop(draftCrop))
        return { ...current, crop: draftCrop }
      const { crop: _crop, ...withoutCrop } = current
      return withoutCrop
    })
    store.setState({ editingImageCropNodeId: null })
  }

  return (
    <>
      <ImageCropToolbar
        draftCrop={draftCrop}
        nodeId={nodeId}
        onApply={applyCrop}
        onCancel={() => store.setState({ editingImageCropNodeId: null })}
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
