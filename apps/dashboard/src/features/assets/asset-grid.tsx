import type { Asset, Folder } from '@talelabs/sdk'
import type { AssetActions, FolderActions } from './asset-actions.types'
import type { AssetLibraryInteractions } from './asset-library.types'

import { useTranslation } from 'react-i18next'
import { AssetCard } from './asset-card'
import { FolderCard } from './folder-card'

export function AssetGrid({
  assetActions,
  assets,
  folderActions,
  folders,
  interactions,
}: {
  assetActions: AssetActions
  assets: Asset[]
  folderActions: FolderActions
  folders: Folder[]
  interactions: AssetLibraryInteractions
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-8 py-5">
      {folders.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="asset-folders-heading">
          <h2
            id="asset-folders-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            {t('assets.folders')}
          </h2>
          <div className="
            grid grid-cols-2 gap-4
            sm:grid-cols-3
            lg:grid-cols-4
            xl:grid-cols-5
            2xl:grid-cols-6
          "
          >
            {folders.map(folder => (
              <FolderCard actions={folderActions} folder={folder} interactions={interactions} key={folder.id} />
            ))}
          </div>
        </section>
      )}
      {assets.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="asset-files-heading">
          <h2
            id="asset-files-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            {t('navigation.assets')}
          </h2>
          <div className="
            grid grid-cols-2 gap-x-4 gap-y-6
            sm:grid-cols-3
            lg:grid-cols-4
            xl:grid-cols-5
            2xl:grid-cols-6
          "
          >
            {assets.map(asset => (
              <AssetCard
                actions={assetActions}
                asset={asset}
                interactions={interactions}
                key={asset.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
