import type { FlowImageCrop } from '@talelabs/flows'
import type { FlowReferenceAsset } from '@talelabs/sdk'
import type { NodeProps } from '@xyflow/react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */
import type { CanvasNode } from '../flow-canvas-types'
import { IconPlayerPlay } from '@tabler/icons-react'
import { assetTypeToValueType } from '@talelabs/flows'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import { cn } from '@talelabs/ui/lib/utils'
import { NodeToolbar, Position } from '@xyflow/react'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetIcon } from '../../../shared/domain-icons'
import { AssetMediaPreview } from '../../assets/asset-media-preview'
import { useAssetDetailQuery } from '../../assets/asset.queries'
import { useFlowCanvas } from '../flow-canvas-context'
import { useFlowMediaPreview } from '../flow-media-preview-context'
import {
  FULL_IMAGE_CROP,
  imageCropAspectRatio,
  imageNodeDisplayAspectRatio,
  isFullImageCrop,
  readImageCrop,
} from '../image-crop'
import { CroppedImagePreview, ImageCropEditor } from '../image-crop-editor'
import { FlowHandle } from './flow-handle'
import { FlowNodeShell } from './flow-node-shell'

function AssetImageCropMode({
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
        <Button
          disabled={isFullImageCrop(draftCrop)}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => setDraftCrop(FULL_IMAGE_CROP)}
        >
          {t('flows.cropEditor.reset')}
        </Button>
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

export const AssetFlowNode = memo(({
  data,
  id,
  selected,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const mediaPreview = useFlowMediaPreview()
  const assetId = canvas.getNode(id)?.assetId
  const asset = assetId ? canvas.referenceData.assetsById.get(assetId) : undefined
  const valueType = assetTypeToValueType(asset?.type ?? 'document')
  const isPlayable = asset?.type === 'video' || asset?.type === 'audio'
  const previewActive = mediaPreview.activeNodeId === id
  const playbackAssetQuery = useAssetDetailQuery(
    assetId ?? null,
    Boolean(isPlayable && previewActive),
  )
  const playbackAsset = playbackAssetQuery.data ?? asset
  const imageSource = asset?.type === 'image'
    ? asset.thumbnailUrl ?? asset.url
    : null
  const editingCrop = canvas.editingImageCropNodeId === id
  const savedCrop = readImageCrop(data.crop)
  const imageContentAspectRatio = asset?.type === 'image'
    ? savedCrop
      ? imageCropAspectRatio(savedCrop, asset.width, asset.height)
      : asset.width && asset.height
        ? asset.width / asset.height
        : 4 / 3
    : 4 / 3
  const imageAspectRatio = imageNodeDisplayAspectRatio(
    imageContentAspectRatio,
  )

  return (
    <FlowNodeShell
      className="w-90"
      footer={asset
        ? (
            <div className="
              relative flex w-full items-center justify-between gap-3
              text-[11px] text-muted-foreground
            "
            >
              <span>{t(`assets.types.${asset.type}`)}</span>
              <div className="relative flex items-center gap-2">
                <span>{t('flows.outputs.asset')}</span>
                <FlowHandle
                  ariaLabel={t('flows.handles.assetOutput')}
                  id="asset"
                  side="output"
                  valueType={valueType}
                />
              </div>
            </div>
          )
        : undefined}
      icon={AssetIcon}
      nodeId={id}
      selected={selected}
      title={asset?.name ?? t('flows.nodes.asset')}
    >
      {asset
        ? editingCrop && imageSource
          ? (
              <AssetImageCropMode
                asset={asset}
                nodeId={id}
                savedCrop={savedCrop}
                src={imageSource}
              />
            )
          : isPlayable
            ? (
                <div
                  className={cn(
                    `
                      relative flex aspect-4/3 items-center justify-center
                      overflow-hidden rounded-lg border border-border/70
                      bg-background
                    `,
                    previewActive && 'nodrag nopan nowheel',
                  )}
                  id={`flow-node-media-${id}`}
                >
                  <div className={cn(
                    'flex size-full items-center justify-center',
                    !previewActive && 'pointer-events-none',
                  )}
                  >
                    <AssetMediaPreview
                      asset={playbackAsset!}
                      className={previewActive ? 'nodrag nopan nowheel' : undefined}
                      mode={previewActive && playbackAsset?.url
                        ? 'player'
                        : 'thumbnail'}
                    />
                  </div>
                  {!previewActive && (
                    <Button
                      aria-label={t('flows.nodeMedia.play', { name: asset.name })}
                      className="
                        nodrag nopan absolute top-1/2 left-1/2 -translate-1/2
                        rounded-full shadow-lg
                      "
                      size="icon"
                      title={t('flows.nodeMedia.play', { name: asset.name })}
                      type="button"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation()
                        mediaPreview.activateNode(id)
                      }}
                    >
                      <IconPlayerPlay aria-hidden />
                    </Button>
                  )}
                </div>
              )
            : (
                <div
                  className="
                    relative flex items-center justify-center overflow-hidden
                    rounded-lg border border-border/70 bg-background
                  "
                  id={`flow-node-media-${id}`}
                  style={{ aspectRatio: imageAspectRatio }}
                >
                  {savedCrop && imageSource
                    ? (
                        <div className="pointer-events-none size-full">
                          <CroppedImagePreview
                            alt={asset.name}
                            crop={savedCrop}
                            sourceHeight={asset.height}
                            sourceWidth={asset.width}
                            src={imageSource}
                          />
                        </div>
                      )
                    : (
                        <div className="pointer-events-none size-full">
                          <AssetMediaPreview asset={asset} />
                        </div>
                      )}
                </div>
              )
        : (
            <button
              className="
                nodrag nopan flex min-h-40 flex-col items-center justify-center
                gap-2 rounded-lg border border-dashed bg-muted/15 p-4
                text-center outline-none
                hover:bg-muted/30
                focus-visible:ring-2 focus-visible:ring-ring
              "
              type="button"
              onClick={() => canvas.openAssetPicker(id)}
            >
              <AssetIcon className="size-7 text-muted-foreground" />
              <span className="text-sm font-medium">{t('flows.chooseAsset')}</span>
              <span className="text-xs text-muted-foreground">
                {t('flows.chooseAssetDescription')}
              </span>
            </button>
          )}
    </FlowNodeShell>
  )
})
