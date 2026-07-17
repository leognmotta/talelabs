/** Public control and command contracts for reusable Asset library composition. */

import type { Asset, AssetSource, AssetType, Folder } from '@talelabs/sdk'
import type { AssetDragData, FolderDragData, LibraryDragData } from '../drag-and-drop/asset-drag-data'

/** Supported visual layouts for the same Asset/folder result set. */
export type AssetLibraryView = 'grid' | 'list'
/** Sort field and direction sent to the paginated Asset query. */
export type AssetSort = 'createdAt' | 'name' | 'sizeBytes'
/** Presentation mode controlling which library controls and selection behavior appear. */
export type AssetLibraryPresentation = 'dialog' | 'page'

/** Server-backed filters that identify one Asset-list cache entry. */
export interface AssetLibraryFilters {
  archived: boolean
  favorite: boolean
  order: 'asc' | 'desc'
  search: string
  sort: AssetSort
  source?: AssetSource
  tagId?: string
  type?: AssetType
}

/** Controlled/uncontrolled inputs and callbacks supported by the reusable library surface. */
export interface AssetLibraryProps {
  allowedTypes?: AssetType[]
  className?: string
  filters?: AssetLibraryFilters
  folderId?: null | string
  initialFolderId?: null | string
  mode?: 'manage' | 'select'
  onFiltersChange?: (filters: AssetLibraryFilters) => void
  onFolderChange?: (folderId: null | string) => void
  onOpenAsset?: (asset: Asset) => void
  onSelect?: (asset: Asset) => void
  onViewChange?: (view: AssetLibraryView) => void
  presentation?: AssetLibraryPresentation
  selectedAssetIds?: string[]
  view?: AssetLibraryView
}

/** Modifier state used to choose single, toggle, or range selection. */
export interface SelectionInput {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

/** Resolved commands shared by grid, list, toolbar, and dialogs. */
export interface AssetLibraryInteractions {
  activeDragData: LibraryDragData | null
  folders: Folder[]
  getAssetDragData: (asset: Asset) => AssetDragData
  getFolderDragData: (folder: Folder) => FolderDragData
  onAssetOpen: (asset: Asset) => void
  onAssetSelect: (asset: Asset, input: SelectionInput) => void
  onFolderOpen: (folder: Folder) => void
  onFolderSelect: (folder: Folder, input: SelectionInput) => void
  mode: 'manage' | 'select'
  selectedAssetIds: Set<string>
  selectedFolderIds: Set<string>
}
