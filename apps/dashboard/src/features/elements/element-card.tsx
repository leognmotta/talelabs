import type { ElementListItem } from '@talelabs/sdk'

import { Badge } from '@talelabs/ui/components/badge'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  MediaLibraryCardDetails,
  MediaLibraryCardPreview,
} from '../../shared/components/media-library-card'
import { elementTypeTranslationKey } from './element-i18n'
import { ELEMENT_TYPE_ICONS } from './element-type-icons'

export function ElementCard({ element }: { element: ElementListItem }) {
  const { t } = useTranslation()
  const Icon = ELEMENT_TYPE_ICONS[element.type]

  return (
    <Link
      className="
        group min-w-0 rounded-xl outline-none
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        focus-visible:ring-offset-background
      "
      to={`/elements/${element.id}`}
    >
      <MediaLibraryCardPreview
        className="
          flex items-center justify-center
          group-hover:ring-foreground/30
        "
      >
        {element.previewThumbnailUrl
          ? (
              <img
                alt=""
                className="size-full object-contain"
                draggable={false}
                loading="lazy"
                src={element.previewThumbnailUrl}
              />
            )
          : <Icon aria-hidden className="size-10 text-muted-foreground" />}
      </MediaLibraryCardPreview>
      <MediaLibraryCardDetails
        trailing={(
          <Badge variant="secondary">
            {t(elementTypeTranslationKey(element.type, 'label'))}
          </Badge>
        )}
      >
        <p className="truncate text-sm font-medium" title={element.name}>
          {element.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t(elementTypeTranslationKey(element.type, 'description'))}
        </p>
      </MediaLibraryCardDetails>
    </Link>
  )
}
