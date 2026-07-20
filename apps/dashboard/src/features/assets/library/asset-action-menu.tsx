/** Canonical Asset command menu shared by cards, rows, and detail surfaces. */

import type { Asset } from '@talelabs/sdk'
import type { AssetActions } from './asset-actions.types'

import {
  IconArchive,
  IconDots,
  IconDownload,
  IconEye,
  IconFolderSymlink,
  IconPencil,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { ElementIcon } from '../../../shared/domain-icons'
import { LibraryItemAction } from './library-item-action'

/** Exposes only commands supplied by the owning library or viewer controller. */
export function AssetActionMenu({ asset, actions, triggerClassName, viewDetails = true }: {
  actions: AssetActions
  asset: Asset
  triggerClassName?: string
  viewDetails?: boolean
}) {
  const { t } = useTranslation()

  return (
    <LibraryItemAction>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(
            <Button
              aria-label={t('common.moreOptions')}
              className={triggerClassName}
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          )}
        >
          <IconDots />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {viewDetails && (
              <DropdownMenuItem onClick={() => actions.onDetails(asset)}>
                <IconEye />
                {t('assets.viewDetails')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => actions.onDownload(asset)}>
              <IconDownload />
              {t('assets.download')}
            </DropdownMenuItem>
            {asset.lifecycle === 'live' && (
              <>
                <DropdownMenuItem onClick={() => actions.onRename(asset)}>
                  <IconPencil />
                  {t('assets.rename')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onMove(asset)}>
                  <IconFolderSymlink />
                  {t('assets.moveToFolder')}
                </DropdownMenuItem>
                {asset.type === 'image' && (
                  <DropdownMenuItem
                    onClick={() => actions.onAddToElement(asset)}
                  >
                    <ElementIcon />
                    {t('elements.addToElementAction')}
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {asset.lifecycle === 'archived'
              ? (
                  <DropdownMenuItem onClick={() => actions.onRestore(asset)}>
                    <IconRestore />
                    {t('assets.restore')}
                  </DropdownMenuItem>
                )
              : (
                  <DropdownMenuItem onClick={() => actions.onArchive(asset)}>
                    <IconArchive />
                    {t('assets.archive')}
                  </DropdownMenuItem>
                )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.onPurge(asset)}
            >
              <IconTrash />
              {t('assets.deletePermanently')}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </LibraryItemAction>
  )
}
