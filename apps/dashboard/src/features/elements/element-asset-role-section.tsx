import type {
  ElementAssetMediaType,
  ElementAssetRoleDefinition,
} from '@talelabs/elements'
import type { ElementAssetLink } from '@talelabs/sdk'

import { IconPhotoPlus, IconUpload } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Progress } from '@talelabs/ui/components/progress'
import { useTranslation } from 'react-i18next'
import {
  MediaLibraryCardDetails,
  MediaLibraryCardPreview,
  MediaLibraryGrid,
} from '../../shared/components/media-library-card'
import { AssetMediaCard } from '../assets/asset-media-card'
import { ElementAssetActionMenu } from './element-asset-action-menu'

export interface ElementUploadItem {
  cancel: () => void
  id: string
  mediaType: ElementAssetMediaType
  name: string
  progress: number
  role: string
}

export function ElementAssetRoleSection({
  description,
  label,
  links,
  onAddExisting,
  onOpenAsset,
  onPrimary,
  onUnlink,
  onUpload,
  pending,
  reservedUploadCount,
  role,
  uploads,
}: {
  description: string
  label: string
  links: ElementAssetLink[]
  onAddExisting: () => void
  onOpenAsset: (assetId: string) => void
  onPrimary: (link: ElementAssetLink) => void
  onUnlink: (link: ElementAssetLink) => void
  onUpload: () => void
  pending: boolean
  reservedUploadCount: number
  role: ElementAssetRoleDefinition
  uploads: ElementUploadItem[]
}) {
  const { t } = useTranslation()
  const currentCount = links.length + reservedUploadCount
  const atLimit = currentCount >= role.maxAssets

  return (
    <section
      className="
        flex flex-col gap-4 border-t pt-6
        first:border-t-0 first:pt-0
      "
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{label}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline">
              {t(`assets.types.${role.accepts[0]}`)}
            </Badge>
            <Badge
              aria-label={t('elements.assetLimits.countLabel', {
                current: currentCount,
                maximum: role.maxAssets,
              })}
              variant="secondary"
            >
              {currentCount}
              {' / '}
              {role.maxAssets}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={atLimit}
            size="sm"
            type="button"
            variant="outline"
            onClick={onAddExisting}
          >
            <IconPhotoPlus data-icon="inline-start" />
            {t('elements.addExisting')}
          </Button>
          <Button
            disabled={atLimit}
            size="sm"
            type="button"
            variant="outline"
            onClick={onUpload}
          >
            <IconUpload data-icon="inline-start" />
            {t('elements.uploadAndAttach')}
          </Button>
        </div>
      </header>
      {links.length === 0 && uploads.length === 0
        ? (
            <p
              className="
                rounded-xl bg-muted/40 px-3 py-6 text-center text-sm
                text-muted-foreground
              "
            >
              {t('elements.roleEmpty')}
            </p>
          )
        : (
            <MediaLibraryGrid>
              {links.map(link => (
                <AssetMediaCard
                  key={`${link.role}:${link.assetId}`}
                  asset={link.asset}
                  badges={(
                    <Badge
                      className="max-w-28 truncate"
                      title={label}
                      variant="outline"
                    >
                      {label}
                    </Badge>
                  )}
                  previewAriaLabel={t('assets.viewDetails')}
                  previewClassName="cursor-pointer"
                  topActions={(
                    <div className="pointer-events-auto ml-auto">
                      <ElementAssetActionMenu
                        isPrimary={link.isPrimary}
                        pending={pending}
                        onDelete={() => onUnlink(link)}
                        onMakeThumbnail={() => onPrimary(link)}
                      />
                    </div>
                  )}
                  onClick={() => onOpenAsset(link.assetId)}
                />
              ))}
              {uploads.map(upload => (
                <article className="min-w-0" key={upload.id}>
                  <MediaLibraryCardPreview className="border border-dashed">
                    <div
                      className="
                        flex size-full flex-col justify-center gap-3 p-4
                      "
                    >
                      <Progress value={upload.progress * 100} />
                      <Button
                        aria-label={t('assets.cancelUpload', { name: upload.name })}
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={upload.cancel}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </MediaLibraryCardPreview>
                  <MediaLibraryCardDetails>
                    <p className="truncate text-sm font-medium" title={upload.name}>
                      {upload.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t(`assets.types.${upload.mediaType}`)}
                    </p>
                    <div className="mt-1">
                      <Badge
                        className="max-w-28 truncate"
                        title={label}
                        variant="outline"
                      >
                        {label}
                      </Badge>
                    </div>
                  </MediaLibraryCardDetails>
                </article>
              ))}
            </MediaLibraryGrid>
          )}
    </section>
  )
}
