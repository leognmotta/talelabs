import type { Folder } from '@talelabs/sdk'
import type { AssetLibraryPresentation } from './asset-library.types'

import { IconFolderPlus } from '@tabler/icons-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@talelabs/ui/components/breadcrumb'
import { Button } from '@talelabs/ui/components/button'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetUploadMenu } from './asset-upload-menu'

export function AssetLibraryHeader({
  mode,
  onChooseFiles,
  onChooseFolder,
  onCreateFolder,
  onNavigateToFolder,
  path,
  presentation,
}: {
  mode: 'manage' | 'select'
  onChooseFiles: () => void
  onChooseFolder: () => void
  onCreateFolder: () => void
  onNavigateToFolder: (folderId: null | string) => void
  path: Folder[]
  presentation: AssetLibraryPresentation
}) {
  const { t } = useTranslation()
  const breadcrumb = (
    <Breadcrumb aria-label={t('assets.folderPath')}>
      <BreadcrumbList>
        <BreadcrumbItem>
          {path.length === 0
            ? (
                <BreadcrumbPage>{t('assets.privateLibrary')}</BreadcrumbPage>
              )
            : (
                <button type="button" onClick={() => onNavigateToFolder(null)}>
                  {t('assets.privateLibrary')}
                </button>
              )}
        </BreadcrumbItem>
        {path.map((folder, index) => (
          <Fragment key={folder.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {index === path.length - 1
                ? (
                    <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                  )
                : (
                    <button
                      type="button"
                      onClick={() => onNavigateToFolder(folder.id)}
                    >
                      {folder.name}
                    </button>
                  )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'select'
              ? t('assets.chooseAsset')
              : t('navigation.assets')}
          </h1>
          {presentation === 'page' && <div className="mt-1">{breadcrumb}</div>}
        </div>
        {mode === 'manage' && (
          <Button type="button" variant="outline" onClick={onCreateFolder}>
            <IconFolderPlus data-icon="inline-start" />
            {t('assets.newFolder')}
          </Button>
        )}
        <AssetUploadMenu
          onChooseFiles={onChooseFiles}
          onChooseFolder={onChooseFolder}
        />
      </div>
      {presentation === 'dialog' && (
        <div
          aria-label={t('assets.source')}
          className="flex min-h-9 items-center gap-3 pb-3"
          role="navigation"
        >
          {breadcrumb}
        </div>
      )}
    </>
  )
}
