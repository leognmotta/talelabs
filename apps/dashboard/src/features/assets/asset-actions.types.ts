import type { Asset, Folder, Tag } from '@talelabs/sdk'

export interface AssetActions {
  onArchive: (asset: Asset) => void
  onDetails: (asset: Asset) => void
  onDownload: (asset: Asset) => void
  onMove: (asset: Asset) => void
  onPurge: (asset: Asset) => void
  onRename: (asset: Asset) => void
  onRestore: (asset: Asset) => void
  onToggleFavorite: (asset: Asset) => void
  onToggleTag: (asset: Asset, tag: Tag) => Promise<void>
  onCreateTag: (asset: Asset, name: string) => Promise<void>
  favoritePending: boolean
  tagPending: boolean
  tags: Tag[]
}

export interface FolderActions {
  onDelete: (folder: Folder) => void
  onMove: (folder: Folder) => void
  onOpen: (folder: Folder) => void
  onRename: (folder: Folder) => void
}
