/** Library heading and folder breadcrumb presentation. */

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
import { AssetUploadMenu } from '../upload/asset-upload-menu'

/** Reports the active folder context without owning navigation or query state. */
export function AssetLibraryHeader({
  aggregate,
  mode,
  onChooseFiles,
  onChooseFolder,
  onCreateFolder,
  onNavigateToFolder,
  path,
  presentation,
  projectScoped,
}: {
  aggregate: boolean
  mode: 'manage' | 'select'
  onChooseFiles: () => void
  onChooseFolder: () => void
  onCreateFolder: () => void
  onNavigateToFolder: (folderId: null | string) => void
  path: Folder[]
  presentation: AssetLibraryPresentation
  projectScoped: boolean
}) {
  const { t } = useTranslation()
  const rootLabel = t(projectScoped
    ? 'projects.projectRoot'
    : 'assets.privateLibrary')
  const breadcrumb = (
    <Breadcrumb aria-label={t('assets.folderPath')}>
      <BreadcrumbList>
        <BreadcrumbItem>
          {aggregate
            ? (
                <BreadcrumbPage>{t('projects.allAssets')}</BreadcrumbPage>
              )
            : path.length === 0
              ? (
                  <BreadcrumbPage>{rootLabel}</BreadcrumbPage>
                )
              : (
                  <button type="button" onClick={() => onNavigateToFolder(null)}>
                    {rootLabel}
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
        {mode === 'manage' && !aggregate && (
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
