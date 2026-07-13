import type { ElementAssetLink, ElementDetail } from '@talelabs/sdk'

import { getElementTypeDefinition } from '@talelabs/elements'
import { Badge } from '@talelabs/ui/components/badge'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useTranslation } from 'react-i18next'
import { MediaLibraryCardPreview } from '../../shared/components/media-library-card'
import { AssetMediaPreview } from '../assets/asset-media-preview'
import { elementTypeTranslationKey } from './element-i18n'
import { ELEMENT_TYPE_ICONS } from './element-type-icons'

function selectPreviewLink(type: ElementDetail['type'], links: ElementAssetLink[]) {
  const previewRole = getElementTypeDefinition(type).previewRole
  const visualLinks = links.filter(link => (
    link.referenceKind === 'master'
    && link.asset.processingState === 'ready'
    && link.asset.lifecycle !== 'purging'
    && link.asset.lifecycle !== 'purged'
    && (
      link.asset.type === 'image'
      || Boolean(link.asset.thumbnailUrl)
    )
  ))

  return visualLinks.find(link => link.isPrimary)
    ?? visualLinks.find(link => link.role === previewRole)
    ?? visualLinks[0]
}

export function ElementIdentityHeader({
  element,
  links,
  loading,
}: {
  element: ElementDetail
  links: ElementAssetLink[]
  loading: boolean
}) {
  const { t } = useTranslation()
  const previewLink = selectPreviewLink(element.type, links)
  const Icon = ELEMENT_TYPE_ICONS[element.type]

  return (
    <section className="
      flex min-w-0 items-center gap-4
      sm:gap-5
    "
    >
      <MediaLibraryCardPreview className="
        size-24 shrink-0
        sm:size-28
      "
      >
        {loading
          ? <Skeleton className="size-full rounded-none" />
          : previewLink
            ? <AssetMediaPreview asset={previewLink.asset} />
            : (
                <div className="flex size-full items-center justify-center">
                  <Icon aria-hidden className="size-10 text-muted-foreground" />
                </div>
              )}
      </MediaLibraryCardPreview>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {t(elementTypeTranslationKey(element.type, 'label'))}
          </Badge>
          {(element.readiness?.state === 'usable'
            || element.readiness?.state === 'strong') && (
            <Badge variant="outline">
              {t('elements.readiness.readyToUse')}
            </Badge>
          )}
          {loading
            ? <Skeleton className="h-5 w-20" />
            : (
                <span className="text-xs text-muted-foreground">
                  {t('elements.referenceCount', { count: links.length })}
                </span>
              )}
        </div>
        <h1 className="
          mt-2 truncate text-2xl font-semibold tracking-tight
          sm:text-3xl
        "
        >
          {element.name}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t(elementTypeTranslationKey(element.type, 'description'))}
        </p>
      </div>
    </section>
  )
}
