/** Local crop editor that commits persistent Asset-node crop data on apply. */

import type { FlowImageCrop } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'

import { useState } from 'react'
import { updateCanvasNodeData } from '../canvas-state/canvas-node-actions'
import { useCanvasStoreApi } from '../canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../flow-canvas-runtime-context'
import {
  FULL_IMAGE_CROP,
  imageCropAspectRatio,
  imageNodeDisplayAspectRatio,
  isFullImageCrop,
} from '../image-crop'
import { ImageCropEditor } from '../image-crop-editor'
import { ImageCropToolbar } from '../image-crop-toolbar'

/** Edits and applies crop metadata for one image Asset node. */
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
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
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
