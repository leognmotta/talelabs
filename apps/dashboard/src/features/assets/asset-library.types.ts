import type { Asset, AssetSource, AssetType, Folder } from '@talelabs/sdk'
import type { AssetDragData, FolderDragData, LibraryDragData } from './drag-and-drop/asset-drag-data'

export type AssetLibraryView = 'grid' | 'list'
export type AssetSort = 'createdAt' | 'name' | 'sizeBytes'
export type AssetLibraryPresentation = 'dialog' | 'page'

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

export interface SelectionInput {
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

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
