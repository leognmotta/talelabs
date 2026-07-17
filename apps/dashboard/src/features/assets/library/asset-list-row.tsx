/** List-mode presentation for one selectable and draggable Asset. */

import type { Asset } from '@talelabs/sdk'
import type { AssetActions } from './asset-actions.types'
import type { AssetLibraryInteractions } from './asset-library.types'

import { Checkbox } from '@talelabs/ui/components/checkbox'
import { TableCell, TableRow } from '@talelabs/ui/components/table'
import { cn } from '@talelabs/ui/lib/utils'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetDragPreview } from '../drag-and-drop/asset-drag-preview'
import { useDraggableAsset } from '../drag-and-drop/use-draggable-asset'
import { formatAssetSize } from '../media/asset-formatters'
import { AssetMediaPreview } from '../media/asset-media-preview'
import { AssetStatusBadge } from '../media/asset-status-badge'
import { useVideoPreviewPlayback } from '../media/use-video-preview-playback'
import { AssetTagBadges } from '../tags/asset-tag-badges'
import { AssetTagPicker } from '../tags/asset-tag-picker'
import { AssetActionMenu } from './asset-action-menu'
import { AssetFavoriteButton } from './asset-favorite-button'

/** Binds one Asset to selection, viewer, drag, favorite, and action commands. */
export function AssetListRow({
  actions,
  asset,
  interactions,
  locale,
  mode,
}: {
  actions: AssetActions
  asset: Asset
  interactions: AssetLibraryInteractions
  locale: string
  mode: 'manage' | 'select'
}) {
  const { t } = useTranslation()
  const elementRef = useRef<HTMLTableRowElement>(null)
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

  return (
    <TableRow
      ref={elementRef}
      className={cn('group select-none', drag.isDragging && 'opacity-40')}
      data-state={selected ? 'selected' : undefined}
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
      {mode === 'select' && (
        <TableCell onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
          <Checkbox
            aria-label={t('assets.selectAsset', { name: asset.name })}
            checked={selected}
            onCheckedChange={() => interactions.onAssetSelect(asset, {
              ctrlKey: true,
              metaKey: false,
              shiftKey: false,
            })}
          />
        </TableCell>
      )}
      <TableCell>
        <button
          ref={dragHandleRef}
          aria-label={t('assets.selectAsset', { name: asset.name })}
          aria-pressed={selected}
          className="
            flex min-w-0 cursor-grab items-center gap-3 text-left
            active:cursor-grabbing
          "
          type="button"
        >
          <span className="
            flex size-10 shrink-0 items-center justify-center overflow-hidden
            rounded-lg bg-muted
          "
          >
            <AssetMediaPreview
              asset={asset}
              videoPreviewActive={videoPreview.active}
              videoRef={videoPreview.videoRef}
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{asset.name}</span>
            <AssetStatusBadge asset={asset} />
          </span>
        </button>
      </TableCell>
      <TableCell className="
        hidden text-muted-foreground
        md:table-cell
      "
      >
        {t(`assets.types.${asset.type}`)}
      </TableCell>
      <TableCell className="
        hidden text-muted-foreground
        lg:table-cell
      "
      >
        {formatAssetSize(asset.sizeBytes, locale) ?? '—'}
      </TableCell>
      <TableCell className="
        hidden
        xl:table-cell
      "
      >
        <AssetTagBadges tags={asset.tags} />
      </TableCell>
      <TableCell className="
        hidden w-40 text-muted-foreground
        sm:table-cell
      "
      >
        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(asset.createdAt))}
      </TableCell>
      <TableCell className="w-10 text-right">
        {mode === 'manage' && (
          <div className="flex items-center justify-end gap-1">
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
            <AssetActionMenu actions={actions} asset={asset} />
          </div>
        )}
      </TableCell>
      <AssetDragPreview asset={asset} container={drag.previewContainer} count={dragData.assetIds.length} />
    </TableRow>
  )
}
