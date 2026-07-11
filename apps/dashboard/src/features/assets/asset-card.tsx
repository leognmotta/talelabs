import type { Asset } from '@talelabs/sdk'
import type { AssetActions } from './asset-actions.types'
import type { AssetLibraryInteractions } from './asset-library.types'

import { cn } from '@talelabs/ui/lib/utils'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetActionMenu } from './asset-action-menu'
import { AssetFavoriteButton } from './asset-favorite-button'
import { formatAssetSize, formatDuration } from './asset-formatters'
import { AssetMediaPreview } from './asset-media-preview'
import { AssetStatusBadge } from './asset-status-badge'
import { AssetTagBadges } from './asset-tag-badges'
import { AssetTagPicker } from './asset-tag-picker'
import { AssetDragPreview } from './drag-and-drop/asset-drag-preview'
import { useDraggableAsset } from './drag-and-drop/use-draggable-asset'
import { useVideoPreviewPlayback } from './use-video-preview-playback'

export function AssetCard({
  actions,
  asset,
  interactions,
}: {
  actions: AssetActions
  asset: Asset
  interactions: AssetLibraryInteractions
}) {
  const { i18n, t } = useTranslation()
  const elementRef = useRef<HTMLElement>(null)
  const dragHandleRef = useRef<HTMLButtonElement>(null)
  const videoPreview = useVideoPreviewPlayback(
    asset.type === 'video' && Boolean(asset.url),
  )
  const selected = interactions.selectedAssetIds.has(asset.id)
  const dragData = interactions.getAssetDragData(asset)
  const drag = useDraggableAsset({
    elementRef,
    dragHandleRef,
    getData: () => interactions.getAssetDragData(asset),
    onDragStart: () => {
      if (!selected)
        interactions.onAssetSelect(asset, { ctrlKey: false, metaKey: false, shiftKey: false })
    },
  })
  const size = formatAssetSize(asset.sizeBytes, i18n.resolvedLanguage ?? 'en')
  const duration = formatDuration(asset.durationSeconds)

  return (
    <article
      ref={elementRef}
      className={cn('group min-w-0 select-none', drag.isDragging && 'opacity-40')}
      onBlur={videoPreview.onBlur}
      onClick={(event) => {
        event.stopPropagation()
        if (!drag.shouldIgnoreClick())
          interactions.onAssetSelect(asset, event)
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (!drag.shouldIgnoreClick())
          interactions.onAssetOpen(asset)
      }}
      onFocus={videoPreview.onFocus}
      onMouseEnter={videoPreview.onMouseEnter}
      onMouseLeave={videoPreview.onMouseLeave}
    >
      <div className={cn(
        `
          relative aspect-square overflow-hidden rounded-xl bg-muted/60 ring-1
          ring-border transition
        `,
        selected && 'ring-2 ring-primary',
      )}
      >
        <button
          ref={dragHandleRef}
          aria-label={t('assets.selectAsset', { name: asset.name })}
          aria-pressed={selected}
          className="
            flex size-full cursor-grab items-center justify-center
            active:cursor-grabbing
          "
          type="button"
        >
          <AssetMediaPreview
            asset={asset}
            videoPreviewActive={videoPreview.active}
            videoRef={videoPreview.videoRef}
          />
        </button>
        <div className="
          pointer-events-none absolute inset-x-2 top-2 flex items-start
          justify-between gap-2
        "
        >
          <AssetStatusBadge asset={asset} />
          <div className="pointer-events-auto flex items-center gap-1">
            <div className="
              pointer-events-none flex items-center gap-1 opacity-0
              transition-opacity
              group-focus-within:pointer-events-auto
              group-focus-within:opacity-100
              group-hover:pointer-events-auto group-hover:opacity-100
            "
            >
              <AssetTagPicker actions={actions} asset={asset} />
              <AssetFavoriteButton actions={actions} asset={asset} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex min-w-0 items-start gap-2 px-0.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={asset.name}>{asset.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t(`assets.types.${asset.type}`)}
            {duration ? ` · ${duration}` : ''}
            {size ? ` · ${size}` : ''}
          </p>
          <div className="mt-1">
            <AssetTagBadges tags={asset.tags} />
          </div>
        </div>
        {interactions.mode === 'manage' && <AssetActionMenu actions={actions} asset={asset} />}
      </div>
      <AssetDragPreview asset={asset} container={drag.previewContainer} count={dragData.assetIds.length} />
    </article>
  )
}
