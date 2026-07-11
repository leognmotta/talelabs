import { IconDots, IconPhotoCheck, IconTrash } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { LibraryItemAction } from '../assets/library-item-action'

export function ElementAssetActionMenu({
  isPrimary,
  onDelete,
  onMakeThumbnail,
  pending,
}: {
  isPrimary: boolean
  onDelete: () => void
  onMakeThumbnail: () => void
  pending: boolean
}) {
  const { t } = useTranslation()

  return (
    <LibraryItemAction>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(
            <Button
              aria-label={t('common.moreOptions')}
              size="icon-sm"
              type="button"
              variant="secondary"
            />
          )}
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isPrimary && (
            <DropdownMenuItem
              disabled={pending}
              onClick={onMakeThumbnail}
            >
              <IconPhotoCheck />
              {t('elements.makeThumbnail')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={pending}
            variant="destructive"
            onClick={onDelete}
          >
            <IconTrash />
            {t('common.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </LibraryItemAction>
  )
}
