import type { Asset, Folder } from '@talelabs/sdk'
import type { AssetActions, FolderActions } from './asset-actions.types'
import type { AssetLibraryInteractions } from './asset-library.types'

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@talelabs/ui/components/table'
import { useTranslation } from 'react-i18next'
import { AssetListRow } from './asset-list-row'
import { FolderListRow } from './folder-list-row'

export function AssetList({
  assetActions,
  assets,
  folderActions,
  folders,
  interactions,
  mode,
}: {
  assetActions: AssetActions
  assets: Asset[]
  folderActions: FolderActions
  folders: Folder[]
  interactions: AssetLibraryInteractions
  mode: 'manage' | 'select'
}) {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage ?? 'en'

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {mode === 'select' && <TableHead className="w-10" />}
          <TableHead>{t('common.name')}</TableHead>
          <TableHead className="
            hidden
            md:table-cell
          "
          >
            {t('assets.type')}
          </TableHead>
          <TableHead className="
            hidden
            lg:table-cell
          "
          >
            {t('assets.size')}
          </TableHead>
          <TableHead className="
            hidden
            xl:table-cell
          "
          >
            {t('assets.tags')}
          </TableHead>
          <TableHead className="
            hidden w-40
            sm:table-cell
          "
          >
            {t('assets.dateCreated')}
          </TableHead>
          <TableHead className="w-10 text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {folders.map(folder => (
          <FolderListRow
            actions={folderActions}
            folder={folder}
            interactions={interactions}
            key={folder.id}
            locale={locale}
            mode={mode}
          />
        ))}
        {assets.map(asset => (
          <AssetListRow
            actions={assetActions}
            asset={asset}
            interactions={interactions}
            key={asset.id}
            locale={locale}
            mode={mode}
          />
        ))}
      </TableBody>
    </Table>
  )
}
