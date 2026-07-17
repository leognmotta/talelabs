/** Serializable drag payload contracts shared by Asset library interactions. */

/** Drag payload for one or more selected Assets. */
export interface AssetDragData extends Record<string, unknown> {
  /** Asset ids moved together by this drag. */
  assetIds: string[]
  /** Folder containing the dragged Assets when the drag began. */
  sourceFolderId: null | string
  /** Payload discriminator. */
  type: 'asset'
}

/** Drag payload for one folder. */
export interface FolderDragData extends Record<string, unknown> {
  /** Folder being moved. */
  folderId: string
  /** Folder's parent when the drag began. */
  parentId: null | string
  /** Payload discriminator. */
  type: 'folder'
}

/** Drop-target payload attached to a folder row or card. */
export interface FolderDropTargetData extends Record<string, unknown> {
  /** Folder that would receive a valid drop. */
  folderId: string
  /** Payload discriminator. */
  type: 'folder-drop-target'
}

/** Any payload that can be moved within the Asset library. */
export type LibraryDragData = AssetDragData | FolderDragData
