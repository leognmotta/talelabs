/** Element summary card with cover, kind, and caller-owned commands. */

import type { Element } from '@talelabs/sdk'

import { IconDots, IconEdit, IconTrash } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'

import {
  MediaLibraryCardDetails,
  MediaLibraryCardPreview,
} from '../../shared/components/media-library-card'
import { ELEMENT_KIND_ICONS, elementKindLabelKey } from './element-kind-meta'

/** Presents one Element without loading its full reference list. */
export function ElementCard({
  element,
  onDelete,
  onOpen,
}: {
  element: Element
  onDelete: (element: Element) => void
  onOpen: (element: Element) => void
}) {
  const { t } = useTranslation()
  const KindIcon = ELEMENT_KIND_ICONS[element.kind]
  const coverUrl = element.coverAsset?.thumbnailUrl ?? element.coverAsset?.url

  return (
    <article className="group min-w-0">
      <button
        aria-label={t('elements.open', { name: element.name })}
        className="
          block w-full rounded-xl text-left outline-none
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
        "
        type="button"
        onClick={() => onOpen(element)}
      >
        <MediaLibraryCardPreview className="group-hover:ring-foreground/30">
          {coverUrl
            ? (
                <img
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                  src={coverUrl}
                />
              )
            : (
                <div
                  className="
                    absolute inset-0 flex items-center justify-center
                    text-muted-foreground
                  "
                >
                  <KindIcon aria-hidden className="size-8" />
                </div>
              )}
        </MediaLibraryCardPreview>
      </button>
      <MediaLibraryCardDetails
        trailing={(
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('elements.actions', { name: element.name })}
              render={<Button size="icon-sm" type="button" variant="ghost" />}
            >
              <IconDots aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onOpen(element)}>
                  <IconEdit aria-hidden />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(element)}
                >
                  <IconTrash aria-hidden />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      >
        <p className="truncate text-sm font-medium">{element.name}</p>
        <p
          className="
            mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground
          "
        >
          <Badge variant="outline">
            {t(elementKindLabelKey(element.kind))}
          </Badge>
          <span>
            {t('elements.referenceCount', { count: element.referenceCount })}
          </span>
        </p>
      </MediaLibraryCardDetails>
    </article>
  )
}
