/** Grid-mode presentation for one selectable and draggable Asset. */

import type { Asset } from '@talelabs/sdk'
import type { AssetActions } from './asset-actions.types'
import type { AssetLibraryInteractions } from './asset-library.types'

import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetDragPreview } from '../drag-and-drop/asset-drag-preview'
import { useDraggableAsset } from '../drag-and-drop/use-draggable-asset'
import { AssetMediaCard } from '../media/asset-media-card'
import { AssetTagPicker } from '../tags/asset-tag-picker'
import { AssetActionMenu } from './asset-action-menu'
import { AssetFavoriteButton } from './asset-favorite-button'

/** Binds one Asset preview to selection, viewer, favorite, drag, and menu actions. */
export function AssetCard({
  actions,
  asset,
  interactions,
}: {
  actions: AssetActions
  asset: Asset
  interactions: AssetLibraryInteractions
}) {
  const { t } = useTranslation()
  const elementRef = useRef<HTMLElement>(null)
  const dragHandleRef = useRef<HTMLButtonElement>(null)
  const selected = interactions.selectedAssetIds.has(asset.id)
  const disabledReason = selected
    ? null
    : interactions.isAssetDisabled?.(asset) ?? null
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

  return (
    <>
      <AssetMediaCard
        articleRef={elementRef}
        asset={asset}
        className={drag.isDragging ? 'opacity-40' : undefined}
        disabledReason={disabledReason}
        previewAriaLabel={t('assets.selectAsset', { name: asset.name })}
        previewAriaPressed={selected}
        previewClassName="cursor-grab active:cursor-grabbing"
        previewRef={dragHandleRef}
        selected={selected}
        topActions={(
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
        )}
        trailing={interactions.mode === 'manage'
          ? <AssetActionMenu actions={actions} asset={asset} />
          : undefined}
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
      />
      <AssetDragPreview asset={asset} container={drag.previewContainer} count={dragData.assetIds.length} />
    </>
  )
}
