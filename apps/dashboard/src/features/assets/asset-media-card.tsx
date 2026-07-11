import type { Asset } from '@talelabs/sdk'
import type { MouseEventHandler, ReactNode, Ref } from 'react'

import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'
import {
  MediaLibraryCardDetails,
  MediaLibraryCardPreview,
} from '../../shared/components/media-library-card'
import { formatAssetSize, formatDuration } from './asset-formatters'
import { AssetMediaPreview } from './asset-media-preview'
import { AssetStatusBadge } from './asset-status-badge'
import { AssetTagBadges } from './asset-tag-badges'
import { useVideoPreviewPlayback } from './use-video-preview-playback'

export function AssetMediaCard({
  articleRef,
  asset,
  badges,
  className,
  onClick,
  onDoubleClick,
  previewAriaLabel,
  previewAriaPressed,
  previewClassName,
  previewRef,
  selected = false,
  topActions,
  trailing,
}: {
  articleRef?: Ref<HTMLElement>
  asset: Asset
  badges?: ReactNode
  className?: string
  onClick?: MouseEventHandler<HTMLElement>
  onDoubleClick?: MouseEventHandler<HTMLElement>
  previewAriaLabel: string
  previewAriaPressed?: boolean
  previewClassName?: string
  previewRef?: Ref<HTMLButtonElement>
  selected?: boolean
  topActions?: ReactNode
  trailing?: ReactNode
}) {
  const { i18n, t } = useTranslation()
  const videoPreview = useVideoPreviewPlayback(
    asset.type === 'video' && Boolean(asset.url),
  )
  const size = formatAssetSize(asset.sizeBytes, i18n.resolvedLanguage ?? 'en')
  const duration = formatDuration(asset.durationSeconds)

  return (
    <article
      ref={articleRef}
      className={cn('group min-w-0 select-none', className)}
      onBlur={videoPreview.onBlur}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onFocus={videoPreview.onFocus}
      onMouseEnter={videoPreview.onMouseEnter}
      onMouseLeave={videoPreview.onMouseLeave}
    >
      <MediaLibraryCardPreview selected={selected}>
        <button
          ref={previewRef}
          aria-label={previewAriaLabel}
          aria-pressed={previewAriaPressed}
          className={cn(
            'flex size-full items-center justify-center',
            previewClassName,
          )}
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
          {topActions}
        </div>
      </MediaLibraryCardPreview>
      <MediaLibraryCardDetails trailing={trailing}>
        <p className="truncate text-sm font-medium" title={asset.name}>
          {asset.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t(`assets.types.${asset.type}`)}
          {duration ? ` · ${duration}` : ''}
          {size ? ` · ${size}` : ''}
        </p>
        {(badges || asset.tags.length > 0) && (
          <div className="mt-1 flex min-w-0 items-center gap-1">
            {badges}
            <AssetTagBadges tags={asset.tags} />
          </div>
        )}
      </MediaLibraryCardDetails>
    </article>
  )
}
