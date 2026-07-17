/** Canonical folder command menu shared by grid and list presentations. */

import type { Folder } from '@talelabs/sdk'
import type { FolderActions } from '../library/asset-actions.types'

import { IconDots, IconFolderSymlink, IconPencil, IconTrash } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { LibraryItemAction } from '../library/library-item-action'

/** Exposes rename, move, and delete commands supplied by the library controller. */
export function FolderActionMenu({ actions, folder }: {
  actions: FolderActions
  folder: Folder
}) {
  const { t } = useTranslation()

  return (
    <LibraryItemAction>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button aria-label={t('common.moreOptions')} size="icon-sm" type="button" variant="ghost" />}
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => actions.onRename(folder)}>
              <IconPencil />
              {t('assets.rename')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onMove(folder)}>
              <IconFolderSymlink />
              {t('assets.moveToFolder')}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => actions.onDelete(folder)}>
              <IconTrash />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </LibraryItemAction>
  )
}
