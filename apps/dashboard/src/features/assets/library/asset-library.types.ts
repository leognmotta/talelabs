/** Public control and command contracts for reusable Asset library composition. */

import type { Asset, AssetSource, AssetType, Folder } from '@talelabs/sdk'
import type { AssetDragData, FolderDragData, LibraryDragData } from '../drag-and-drop/asset-drag-data'

/** Supported visual layouts for the same Asset/folder result set. */
export type AssetLibraryView = 'grid' | 'list'
/** Sort field and direction sent to the paginated Asset query. */
export type AssetSort = 'createdAt' | 'name' | 'sizeBytes'
/** Presentation mode controlling which library controls and selection behavior appear. */
export type AssetLibraryPresentation = 'dialog' | 'page'
/** Aggregate sentinel kept distinct from the physical root folder. */
export const ASSET_LIBRARY_ALL_FOLDERS = 'all'

/** One source entity selected for generated-Asset filtering. */
export type AssetGeneratedByFilter
  = | { id: string, kind: 'createSession' }
    | { id: string, kind: 'flow' }

/** Server-backed filters that identify one Asset-list cache entry. */
export interface AssetLibraryFilters {
  archived: boolean
  favorite: boolean
  generatedBy?: AssetGeneratedByFilter
  order: 'asc' | 'desc'
  /** Undefined includes every location; null selects Private. */
  projectId?: null | string
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
  /** Aggregate sentinel, physical root null, or one physical folder id. */
  folderId?: null | string
  initialFolderId?: null | string
  /** Localized reason an Asset cannot be selected right now, or null. */
  isAssetDisabled?: (asset: Asset) => null | string
  mode?: 'manage' | 'select'
  onFiltersChange?: (filters: AssetLibraryFilters) => void
  onFolderChange?: (folderId: null | string) => void
  onOpenAsset?: (asset: Asset) => void
  onSelect?: (asset: Asset) => void
  /** Reports each upload batch started from this library instance. */
  onUploadBatch?: (batchId: string) => void
  onViewChange?: (view: AssetLibraryView) => void
  presentation?: AssetLibraryPresentation
  /** Fixed Project scope, with null representing Private and undefined global. */
  projectId?: null | string
  selectedAssetIds?: string[]
  /** Project destination for new uploads when it differs from the browse scope. */
  uploadProjectId?: null | string
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
  isAssetDisabled?: (asset: Asset) => null | string
  onAssetOpen: (asset: Asset) => void
  onAssetSelect: (asset: Asset, input: SelectionInput) => void
  onFolderOpen: (folder: Folder) => void
  onFolderSelect: (folder: Folder, input: SelectionInput) => void
  mode: 'manage' | 'select'
  selectedAssetIds: Set<string>
  selectedFolderIds: Set<string>
}
