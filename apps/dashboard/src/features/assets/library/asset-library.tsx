/** Primary Asset library composition across queries, selection, and dialogs. */

import type { AssetPageParam } from '../data/asset-queries'
import type {
  AssetLibraryInteractions,
  AssetLibraryProps,
} from './asset-library.types'

import {
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@talelabs/ui/components/alert'
import { Button } from '@talelabs/ui/components/button'
import { cn } from '@talelabs/ui/lib/utils'
import {
  useDeferredValue,
  useMemo,
  useRef,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { useAssetMutations } from '../data/asset-mutations'
import {
  ASSET_LIBRARY_PAGE_SIZE,
  useAssetLibraryQuery,
} from '../data/asset-queries'
import { useFolderMutations } from '../data/folder-mutations'
import { useFoldersQuery } from '../data/folder-query'
import { useTagMutations } from '../data/tag-mutations'
import { useTagsQuery } from '../data/tag-query'
import { getFolderPath } from '../media/asset-formatters'
import { AssetFileDropOverlay } from '../upload/asset-file-drop-overlay'
import { ACCEPTED_ASSET_MEDIA } from '../upload/asset-upload-files'
import { AssetGrid } from './asset-grid'
import { AssetLibraryDialogs } from './asset-library-dialogs'
import { AssetLibraryEmpty } from './asset-library-empty'
import { AssetLibraryHeader } from './asset-library-header'
import { AssetLibraryPagination } from './asset-library-pagination'
import { AssetLibrarySkeleton } from './asset-library-skeleton'
import { AssetLibraryToolbar } from './asset-library-toolbar'
import { AssetList } from './asset-list'
import { useAssetLibraryActions } from './use-asset-library-actions'
import { useAssetLibraryControls } from './use-asset-library-controls'
import { useAssetLibraryMove } from './use-asset-library-move'
import { useAssetLibrarySelection } from './use-asset-library-selection'
import { useAssetLibraryUpload } from './use-asset-library-upload'

/** Coordinates URL/local controls with server results and reusable picker mode. */
export function AssetLibrary({
  allowedTypes,
  className,
  filters: controlledFilters,
  folderId: controlledFolderId,
  initialFolderId = null,
  mode = 'manage',
  onFiltersChange,
  onFolderChange,
  onOpenAsset = () => {},
  onSelect = () => {},
  onViewChange,
  presentation = 'page',
  selectedAssetIds,
  view: controlledView,
}: AssetLibraryProps) {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()
  const libraryRef = useRef<HTMLElement>(null)
  const controls = useAssetLibraryControls({
    filters: controlledFilters,
    folderId: controlledFolderId,
    initialFolderId,
    onFiltersChange,
    onFolderChange,
    onViewChange,
    view: controlledView,
  })
  const { filters, folderId, view } = controls
  const search = filters.search.trim()
  const deferredSearch = useDeferredValue(search)
  const foldersQuery = useFoldersQuery()
  const tagsQuery = useTagsQuery()
  const assetsQuery = useAssetLibraryQuery({
    ...filters,
    folderId,
    search: deferredSearch,
    type: allowedTypes?.length ? allowedTypes : filters.type,
  })
  const searchPending
    = !assetsQuery.isPending
      && (search !== deferredSearch
        || assetsQuery.isPlaceholderData
        || (Boolean(deferredSearch)
          && assetsQuery.isFetching
          && !assetsQuery.isFetchingNextPage))
  const assetMutations = useAssetMutations()
  const tagMutations = useTagMutations()
  const folderMutations = useFolderMutations()
  const folders = useMemo(
    () => foldersQuery.data?.data ?? [],
    [foldersQuery.data?.data],
  )
  const upload = useAssetLibraryUpload({
    folderId,
    folders,
  })
  const tags = useMemo(
    () => tagsQuery.data?.data ?? [],
    [tagsQuery.data?.data],
  )
  const assets = useMemo(
    () => assetsQuery.data?.pages.flatMap(page => page.data) ?? [],
    [assetsQuery.data?.pages],
  )
  const currentAssetPage = assetsQuery.data?.pageParams[0] as
    | AssetPageParam
    | undefined
  const loadedAssetCount
    = (currentAssetPage?.previousCursors.length ?? 0)
      * ASSET_LIBRARY_PAGE_SIZE
      + assets.length
  const currentFolders
    = filters.archived || filters.favorite || filters.tagId
      ? []
      : folders
          .filter(folder => folder.parentId === folderId)
          .filter(
            folder =>
              !deferredSearch
              || folder.name
                .toLocaleLowerCase()
                .includes(deferredSearch.toLocaleLowerCase()),
          )
  const visibleAssetIds = useMemo(
    () => assets.map(asset => asset.id),
    [assets],
  )
  const visibleFolderIds = currentFolders.map(folder => folder.id)
  const path = useMemo(
    () => getFolderPath(folders, folderId),
    [folderId, folders],
  )
  const selection = useAssetLibrarySelection({
    assets,
    mode,
    selectedAssetIds,
    visibleAssetIds,
    visibleFolderIds,
  })

  function navigateToFolder(nextFolderId: null | string) {
    controls.navigateToFolder(nextFolderId)
    selection.clear()
  }

  const libraryActions = useAssetLibraryActions({
    assetMutations,
    getSelectedAssets: selection.getSelectedAssets,
    navigateToFolder,
    onOpenAsset,
    organizationId,
    tagMutations,
    tags,
  })
  const move = useAssetLibraryMove({
    assets,
    clearSelection: selection.clear,
    folders,
    libraryRef,
    moveAssets: (movingAssets, destinationFolderId) =>
      assetMutations.move.mutateAsync({
        assets: movingAssets,
        destinationFolderId,
        organizationId: organizationId!,
      }),
    moveFolder: (folder, destinationFolderId) =>
      folderMutations.update.mutateAsync({
        id: folder.id,
        organizationId: organizationId!,
        parentId: destinationFolderId,
      }),
  })

  const interactions: AssetLibraryInteractions = {
    activeDragData: move.activeDragData,
    folders,
    getAssetDragData: selection.getAssetDragData,
    getFolderDragData: move.getFolderDragData,
    mode,
    onAssetOpen: asset =>
      mode === 'manage' ? onOpenAsset(asset) : onSelect(asset),
    onAssetSelect: (asset, input) => {
      selection.selectAsset(asset.id, input)
      if (mode === 'select')
        onSelect(asset)
    },
    onFolderOpen: folder => navigateToFolder(folder.id),
    onFolderSelect: (folder, input) =>
      selection.selectFolder(folder.id, input),
    selectedAssetIds: selection.selectedAssetIds,
    selectedFolderIds: selection.selectedFolderIds,
  }

  const filtered = Boolean(
    filters.search
    || filters.type
    || filters.source
    || filters.archived
    || filters.favorite
    || filters.tagId,
  )
  const dialogPresentation = presentation === 'dialog'

  return (
    <section
      ref={libraryRef}
      aria-label={t('assets.library')}
      className={cn('flex min-h-0 flex-1 flex-col outline-none', className)}
      tabIndex={-1}
    >
      <input
        ref={upload.fileInputRef}
        accept={ACCEPTED_ASSET_MEDIA}
        aria-label={t('assets.chooseFiles')}
        className="sr-only"
        multiple
        type="file"
        onChange={(event) => {
          if (event.target.files)
            void upload.uploadFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={(input) => {
          upload.folderInputRef.current = input
          if (input)
            input.webkitdirectory = true
        }}
        accept={ACCEPTED_ASSET_MEDIA}
        aria-label={t('assets.chooseFolder')}
        className="sr-only"
        multiple
        type="file"
        onChange={(event) => {
          if (event.target.files)
            void upload.uploadFiles(event.target.files)
          event.target.value = ''
        }}
      />
      <div
        className={cn(
          dialogPresentation
          && `
            shrink-0 border-b bg-popover px-5 pt-5 pr-20
            sm:px-7 sm:pr-20
          `,
          !dialogPresentation && 'contents',
        )}
      >
        <AssetLibraryHeader
          mode={mode}
          onChooseFiles={upload.openFilePicker}
          onChooseFolder={upload.openFolderPicker}
          onCreateFolder={() => libraryActions.setNameDialog({ kind: 'create-folder' })}
          onNavigateToFolder={navigateToFolder}
          path={path}
          presentation={presentation}
        />
        <AssetLibraryToolbar
          filters={filters}
          onFiltersChange={controls.updateFilters}
          onViewChange={controls.updateView}
          presentation={presentation}
          searchPending={searchPending}
          tags={tags}
          view={view}
        />
      </div>
      <div
        className={cn(
          dialogPresentation
          && `
            flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5
            sm:px-7 sm:pb-7
          `,
          !dialogPresentation && 'contents',
        )}
      >
        {(assetsQuery.isError || foldersQuery.isError || tagsQuery.isError) && (
          <Alert className="mt-4" variant="destructive">
            <IconAlertCircle />
            <AlertTitle>{t('assets.couldNotLoad')}</AlertTitle>
            <AlertDescription>
              {t('assets.couldNotLoadDescription')}
            </AlertDescription>
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void assetsQuery.refetch()
                  void foldersQuery.refetch()
                  void tagsQuery.refetch()
                }}
              >
                <IconRefresh data-icon="inline-start" />
                {t('common.retry')}
              </Button>
            </AlertAction>
          </Alert>
        )}
        <div
          {...upload.fileDrop.dropTargetProps}
          className={cn(
            'relative flex flex-1 flex-col rounded-xl',
            dialogPresentation && 'pt-5',
          )}
          onClick={selection.clear}
        >
          {assetsQuery.isPending || foldersQuery.isPending
            ? (
                <AssetLibrarySkeleton />
              )
            : assets.length === 0 && currentFolders.length === 0
              ? (
                  <AssetLibraryEmpty filtered={filtered} onUpload={upload.openFilePicker} />
                )
              : view === 'grid'
                ? (
                    <AssetGrid
                      assetActions={libraryActions.assetActions}
                      assets={assets}
                      folderActions={libraryActions.folderActions}
                      folders={currentFolders}
                      interactions={interactions}
                    />
                  )
                : (
                    <AssetList
                      assetActions={libraryActions.assetActions}
                      assets={assets}
                      folderActions={libraryActions.folderActions}
                      folders={currentFolders}
                      interactions={interactions}
                      mode={mode}
                    />
                  )}
          {upload.fileDrop.isDraggingFiles && <AssetFileDropOverlay />}
        </div>
        <AssetLibraryPagination
          assetCount={loadedAssetCount}
          filtered={filtered}
          folderCount={currentFolders.length}
          hasNextPage={assetsQuery.hasNextPage}
          hasPreviousPage={assetsQuery.hasPreviousPage}
          isFetchingNextPage={assetsQuery.isFetchingNextPage}
          isFetchingPreviousPage={assetsQuery.isFetchingPreviousPage}
          onNextPage={() => void assetsQuery.fetchNextPage()}
          onPreviousPage={() => void assetsQuery.fetchPreviousPage()}
        />
      </div>
      <AssetLibraryDialogs
        actions={libraryActions}
        assetMutations={assetMutations}
        folderId={folderId}
        folderMutations={folderMutations}
        folders={folders}
        moveLibraryItems={move.moveLibraryItems}
      />
    </section>
  )
}
