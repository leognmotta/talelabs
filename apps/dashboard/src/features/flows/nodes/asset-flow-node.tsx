import type { NodeProps } from '@xyflow/react'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */
import type { CanvasNode } from '../flow-canvas-types'
import { IconPlayerPlay } from '@tabler/icons-react'
import { assetTypeToValueType } from '@talelabs/flows'
import { Button } from '@talelabs/ui/components/button'
import { Spinner } from '@talelabs/ui/components/spinner'
import { cn } from '@talelabs/ui/lib/utils'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetIcon } from '../../../shared/domain-icons'
import { AssetMediaPreview } from '../../assets/asset-media-preview'
import { useAssetDetailQuery } from '../../assets/asset.queries'
import { FlowActionTooltip } from '../flow-action-tooltip'
import { useFlowCanvas } from '../flow-canvas-context'
import { useFlowMediaPreview } from '../flow-media-preview-context'
import { readImageCrop } from '../image-crop'
import { CroppedImagePreview } from '../image-crop-editor'
import { AssetImageCropMode } from './asset-image-crop-mode'
import { aspectRatioFromDimensions } from './flow-node-aspect-ratio'
import { FlowNodeOutputFooter } from './flow-node-output-footer'
import { FlowNodePreviewStage } from './flow-node-preview-stage'
import { FlowNodeSelectionStage } from './flow-node-selection-stage'
import { FlowNodeShell } from './flow-node-shell'
import { FlowNodeUploadProgress } from './flow-node-upload-progress'

export const AssetFlowNode = memo(({
  data,
  id,
  selected,
}: NodeProps<CanvasNode>) => {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const mediaPreview = useFlowMediaPreview()
  const [measuredMedia, setMeasuredMedia] = useState<{
    aspectRatio: number
    assetId: string
  } | null>(null)
  const [videoPlaybackStarted, setVideoPlaybackStarted] = useState(false)
  const assetId = canvas.getNode(id)?.assetId
  const assetUpload = canvas.getAssetUpload(id)
  const referenceAsset = assetId
    ? canvas.referenceData.assetsById.get(assetId)
    : undefined
  const asset = assetUpload?.asset ?? referenceAsset
  const displayAsset = assetUpload && asset
    ? {
        ...asset,
        processingState: 'ready' as const,
        thumbnailUrl: asset.type === 'image'
          ? assetUpload.previewUrl
          : asset.thumbnailUrl,
        url: assetUpload.previewUrl,
      }
    : asset
  const valueType = assetTypeToValueType(asset?.type ?? 'document')
  const isPlayable = asset?.type === 'video' || asset?.type === 'audio'
  const previewActive = mediaPreview.activeNodeId === id
  const videoPlaybackLoading = asset?.type === 'video'
    && previewActive
    && !videoPlaybackStarted
  const playbackActionLabel = videoPlaybackLoading
    ? t('common.loading')
    : t('flows.nodeMedia.play', { name: asset?.name ?? '' })
  const playbackAssetQuery = useAssetDetailQuery(
    assetUpload ? null : assetId ?? null,
    Boolean(!assetUpload && isPlayable && previewActive),
  )
  const playbackAsset = assetUpload
    ? displayAsset
    : playbackAssetQuery.data ?? asset
  const imageSource = displayAsset?.type === 'image'
    ? displayAsset.thumbnailUrl ?? displayAsset.url
    : null
  const editingCrop = canvas.editingImageCropNodeId === id
  const savedCrop = readImageCrop(data.crop)
  const declaredSourceAspectRatio = asset
    && (asset.type === 'image' || asset.type === 'video')
    ? aspectRatioFromDimensions(asset.width, asset.height)
    : null
  const sourceAspectRatio = asset && measuredMedia?.assetId === asset.id
    ? measuredMedia.aspectRatio
    : declaredSourceAspectRatio
  const previewAspectRatio = asset?.type === 'image'
    && savedCrop
    && sourceAspectRatio
    ? sourceAspectRatio * savedCrop.width / savedCrop.height
    : sourceAspectRatio ?? undefined

  function recordMediaAspectRatio(aspectRatio: number) {
    if (!asset || !Number.isFinite(aspectRatio) || aspectRatio <= 0)
      return
    setMeasuredMedia({ aspectRatio, assetId: asset.id })
  }

  return (
    <FlowNodeShell
      className="w-96"
      contentClassName="gap-0 p-0"
      footer={asset
        ? (
            <FlowNodeOutputFooter
              ariaLabel={t('flows.handles.assetOutput')}
              handleId="asset"
              label={t('flows.outputs.asset')}
              valueType={valueType}
            >
              <span>{t(`assets.types.${asset.type}`)}</span>
            </FlowNodeOutputFooter>
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
          : (
              <FlowNodePreviewStage
                aspectRatio={previewAspectRatio}
                valueType={valueType}
              >
                {isPlayable
                  ? (
                      <div
                        className={cn(
                          `
                            absolute inset-0 flex items-center justify-center
                            overflow-hidden
                          `,
                          previewActive && 'nodrag nopan nowheel',
                        )}
                        id={`flow-node-media-${id}`}
                      >
                        <div className={cn(
                          'flex size-full items-center justify-center',
                          !previewActive && 'pointer-events-none',
                          videoPlaybackLoading && 'opacity-0',
                        )}
                        >
                          <AssetMediaPreview
                            asset={playbackAsset!}
                            className={cn(
                              'object-cover',
                              previewActive && 'nodrag nopan nowheel',
                            )}
                            mode={previewActive && playbackAsset?.url
                              ? 'player'
                              : 'thumbnail'}
                            onAspectRatioChange={recordMediaAspectRatio}
                            videoAutoPlay={asset.type === 'video' && previewActive}
                            videoPreviewActive={Boolean(assetUpload)}
                            onVideoPlaybackError={() =>
                              setVideoPlaybackStarted(true)}
                            onVideoPlaying={() => setVideoPlaybackStarted(true)}
                          />
                        </div>
                        {(!previewActive || videoPlaybackLoading) && (
                          <FlowActionTooltip
                            className="
                              nodrag nopan absolute top-1/2 left-1/2
                              -translate-1/2 rounded-full
                            "
                            disabled={videoPlaybackLoading}
                            label={playbackActionLabel}
                          >
                            <Button
                              aria-label={playbackActionLabel}
                              className="
                                rounded-full shadow-lg
                                disabled:opacity-100
                              "
                              disabled={videoPlaybackLoading}
                              size="icon"
                              type="button"
                              variant="secondary"
                              onClick={(event) => {
                                event.stopPropagation()
                                setVideoPlaybackStarted(false)
                                mediaPreview.activateNode(id)
                              }}
                            >
                              {videoPlaybackLoading
                                ? <Spinner aria-label={t('common.loading')} />
                                : <IconPlayerPlay aria-hidden />}
                            </Button>
                          </FlowActionTooltip>
                        )}
                      </div>
                    )
                  : (
                      <div
                        className="
                          pointer-events-none absolute inset-0 flex items-center
                          justify-center overflow-hidden
                        "
                        id={`flow-node-media-${id}`}
                      >
                        {savedCrop && imageSource
                          ? (
                              <CroppedImagePreview
                                alt={asset.name}
                                crop={savedCrop}
                                frameAspectRatio={previewAspectRatio ?? 1}
                                onSourceAspectRatioChange={recordMediaAspectRatio}
                                sourceHeight={asset.height}
                                sourceWidth={asset.width}
                                src={imageSource}
                              />
                            )
                          : (
                              <AssetMediaPreview
                                asset={displayAsset!}
                                className="object-cover"
                                onAspectRatioChange={recordMediaAspectRatio}
                              />
                            )}
                      </div>
                    )}
                {assetUpload?.status === 'uploading' && (
                  <FlowNodeUploadProgress
                    name={asset.name}
                    progress={assetUpload.progress}
                  />
                )}
              </FlowNodePreviewStage>
            )
        : (
            <FlowNodeSelectionStage
              description={t('flows.chooseAssetDescription')}
              icon={AssetIcon}
              label={t('flows.chooseAsset')}
              valueType="Asset"
              onSelect={() => canvas.openAssetPicker(id)}
            />
          )}
    </FlowNodeShell>
  )
})
